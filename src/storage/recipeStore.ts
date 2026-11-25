import { mergeRecipes, upgradeRecipe } from '../domain/recipe';
import { SCHEMA_VERSION } from '../domain/types';
import type { Recipe } from '../domain/types';
import { DropboxClient, DropboxError } from './dropbox';

/** Minimal async key-value store (AsyncStorage implements this). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const RECIPES_FOLDER = '/recipes';

interface Meta {
  /** Dropbox revision the local copy is based on. */
  rev?: string;
  /** Local changes not yet uploaded. */
  dirty?: boolean;
}

interface State {
  meta: Record<string, Meta>;
  /** Recipes deleted locally whose Dropbox file still has to be removed. */
  deleted: string[];
}

const STATE_KEY = 'kitchen:state';
const recipeKey = (id: string) => `kitchen:recipe:${id}`;
const recipePath = (id: string) => `${RECIPES_FOLDER}/${id}.json`;

export interface SyncResult {
  downloaded: number;
  uploaded: number;
  removed: number;
  conflictsMerged: number;
}

/**
 * Offline-first recipe storage. Every recipe is cached on the device and
 * mirrored as /recipes/<id>.json in the Dropbox app folder. Edits are saved
 * locally first and uploaded on the next sync; when Dropbox has a newer
 * version, both versions are merged (no note is ever lost).
 */
export class RecipeStore {
  private recipes = new Map<string, Recipe>();
  private state: State = { meta: {}, deleted: [] };
  private listeners = new Set<() => void>();

  constructor(
    private readonly kv: KeyValueStore,
    private dropbox?: DropboxClient,
  ) {}

  setDropbox(client: DropboxClient | undefined) {
    this.dropbox = client;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  async load(): Promise<void> {
    const raw = await this.kv.getItem(STATE_KEY);
    if (raw) this.state = { ...{ meta: {}, deleted: [] }, ...(JSON.parse(raw) as Partial<State>) };
    await Promise.all(
      Object.keys(this.state.meta).map(async (id) => {
        const json = await this.kv.getItem(recipeKey(id));
        if (!json) return;
        const stored: unknown = JSON.parse(json);
        const r = upgradeRecipe(stored);
        if (!r) return;
        this.recipes.set(id, r);
        if ((stored as { schemaVersion?: number }).schemaVersion !== SCHEMA_VERSION) {
          // Upgrade the cached copy and re-upload it in the current format.
          this.state.meta[id] = { ...this.state.meta[id], dirty: true };
          await this.kv.setItem(recipeKey(id), JSON.stringify(r));
        }
      }),
    );
    await this.persistState();
    this.emit();
  }

  all(): Recipe[] {
    return [...this.recipes.values()];
  }

  get(id: string): Recipe | undefined {
    return this.recipes.get(id);
  }

  pendingCount(): number {
    return Object.values(this.state.meta).filter((m) => m.dirty).length + this.state.deleted.length;
  }

  private async persistState() {
    await this.kv.setItem(STATE_KEY, JSON.stringify(this.state));
  }

  private async putLocal(recipe: Recipe, meta: Meta) {
    this.recipes.set(recipe.id, recipe);
    this.state.meta[recipe.id] = meta;
    await this.kv.setItem(recipeKey(recipe.id), JSON.stringify(recipe));
    await this.persistState();
  }

  /** Save locally and try to upload right away. */
  async save(recipe: Recipe): Promise<void> {
    const meta = this.state.meta[recipe.id] ?? {};
    await this.putLocal(recipe, { ...meta, dirty: true });
    this.emit();
    if (this.dropbox) {
      try {
        await this.uploadOne(recipe.id);
        this.emit();
      } catch {
        // stays dirty; retried on next sync
      }
    }
  }

  async remove(id: string): Promise<void> {
    this.recipes.delete(id);
    delete this.state.meta[id];
    this.state.deleted = [...new Set([...this.state.deleted, id])];
    await this.kv.removeItem(recipeKey(id));
    await this.persistState();
    this.emit();
    if (this.dropbox) await this.sync().catch(() => undefined);
  }

  private async uploadOne(id: string): Promise<'uploaded' | 'merged'> {
    const dropbox = this.dropbox!;
    let recipe = this.recipes.get(id)!;
    let meta = this.state.meta[id] ?? {};
    let merged = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const file = await dropbox.upload(recipePath(id), JSON.stringify(recipe, null, 2), { rev: meta.rev });
        await this.putLocal(recipe, { rev: file.rev, dirty: false });
        return merged ? 'merged' : 'uploaded';
      } catch (e) {
        if (!(e instanceof DropboxError) || !e.isConflict) throw e;
        // Someone else changed it: merge with the remote version and retry.
        const remote = await dropbox.download(recipePath(id));
        if (!remote) {
          meta = {};
          continue;
        }
        const parsed = upgradeRecipe(JSON.parse(remote.text));
        recipe = parsed ? mergeRecipes(recipe, parsed) : recipe;
        meta = { rev: remote.rev, dirty: true };
        merged = true;
      }
    }
    throw new Error(`Could not upload ${id} after repeated conflicts`);
  }

  /** Two-way sync with Dropbox. */
  async sync(): Promise<SyncResult> {
    const dropbox = this.dropbox;
    if (!dropbox) throw new Error('Dropbox is not connected');
    const result: SyncResult = { downloaded: 0, uploaded: 0, removed: 0, conflictsMerged: 0 };

    // 1. Push local deletions.
    for (const id of [...this.state.deleted]) {
      await dropbox.delete(recipePath(id));
      this.state.deleted = this.state.deleted.filter((d) => d !== id);
      await this.persistState();
    }

    // 2. Pull remote changes.
    const files = (await dropbox.listFolder(RECIPES_FOLDER)).filter((f) => f.name.endsWith('.json'));
    const remoteIds = new Set<string>();
    for (const file of files) {
      const id = file.name.replace(/\.json$/, '');
      remoteIds.add(id);
      const meta = this.state.meta[id];
      if (meta?.rev === file.rev) continue;
      if (meta?.dirty) continue; // handled by upload (conflict -> merge)
      const remote = await dropbox.download(file.path);
      if (!remote) continue;
      const raw: unknown = JSON.parse(remote.text);
      const parsed = upgradeRecipe(raw);
      if (!parsed) continue;
      // Files in an older format are rewritten in the current one.
      const outdated = (raw as { schemaVersion?: number }).schemaVersion !== SCHEMA_VERSION;
      await this.putLocal({ ...parsed, id }, { rev: remote.rev, dirty: outdated });
      result.downloaded++;
    }

    // 3. Recipes deleted on another device.
    for (const [id, meta] of Object.entries(this.state.meta)) {
      if (meta.rev && !meta.dirty && !remoteIds.has(id)) {
        this.recipes.delete(id);
        delete this.state.meta[id];
        await this.kv.removeItem(recipeKey(id));
        result.removed++;
      }
    }
    await this.persistState();

    // 4. Push local changes.
    for (const [id, meta] of Object.entries(this.state.meta)) {
      if (!meta.dirty) continue;
      const outcome = await this.uploadOne(id);
      result.uploaded++;
      if (outcome === 'merged') result.conflictsMerged++;
    }

    this.emit();
    return result;
  }
}
