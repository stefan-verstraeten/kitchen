import { describe, expect, it } from 'vitest';

import { addCookedDate, emptyRecipe } from '../src/domain/recipe';
import { DropboxClient, DropboxError, type DropboxFile } from '../src/storage/dropbox';
import { RecipeStore, type KeyValueStore } from '../src/storage/recipeStore';

class MemoryKv implements KeyValueStore {
  data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  async removeItem(k: string) {
    this.data.delete(k);
  }
}

/** In-memory stand-in for Dropbox with revision checks. */
class FakeDropbox extends DropboxClient {
  files = new Map<string, { text: string; rev: string }>();
  private n = 0;
  constructor() {
    super(async () => 'token');
  }
  override async listFolder(folder: string): Promise<DropboxFile[]> {
    return [...this.files.entries()]
      .filter(([p]) => p.startsWith(folder + '/'))
      .map(([p, f]) => ({ name: p.split('/').pop()!, path: p, rev: f.rev, serverModified: '' }));
  }
  override async download(path: string) {
    return this.files.get(path);
  }
  override async upload(path: string, content: string, opts: { rev?: string; overwrite?: boolean } = {}) {
    const existing = this.files.get(path);
    if (existing && !opts.overwrite && existing.rev !== opts.rev) throw new DropboxError(409, 'path/conflict/file/');
    const rev = `r${++this.n}`;
    this.files.set(path, { text: content, rev });
    return { name: path.split('/').pop()!, path, rev, serverModified: '' };
  }
  override async delete(path: string) {
    this.files.delete(path);
  }
}

describe('RecipeStore', () => {
  it('uploads, syncs to a second device and merges concurrent notes', async () => {
    const dropbox = new FakeDropbox();
    const phone = new RecipeStore(new MemoryKv(), dropbox);
    const tablet = new RecipeStore(new MemoryKv(), dropbox);

    const recipe = emptyRecipe('nl', 'Waterzooi');
    await phone.save(recipe);
    expect(dropbox.files.has(`/recipes/${recipe.id}.json`)).toBe(true);

    expect((await tablet.sync()).downloaded).toBe(1);

    // Both devices log a cooked date; the tablet is offline at the time.
    tablet.setDropbox(undefined);
    await tablet.save(addCookedDate(tablet.get(recipe.id)!, '2026-11-02'));
    await phone.save(addCookedDate(phone.get(recipe.id)!, '2026-11-03'));
    tablet.setDropbox(dropbox);
    const result = await tablet.sync();
    expect(result.conflictsMerged).toBe(1);

    await phone.sync();
    const dates = phone.get(recipe.id)!.notes.map((n) => n.date).sort();
    expect(dates).toEqual(['2026-11-02', '2026-11-03']);
  });

  it('propagates deletions and survives a reload from local cache', async () => {
    const dropbox = new FakeDropbox();
    const kv = new MemoryKv();
    const a = new RecipeStore(kv, dropbox);
    const b = new RecipeStore(new MemoryKv(), dropbox);
    const r = emptyRecipe('en', 'Pancakes');
    await a.save(r);
    await b.sync();
    await a.remove(r.id);
    expect([...dropbox.files.keys()].some((p) => p.startsWith('/recipes/'))).toBe(false);
    await b.sync();
    expect(b.get(r.id)).toBeUndefined();

    const r2 = emptyRecipe('en', 'Crêpes');
    await a.save(r2);
    const reloaded = new RecipeStore(kv);
    await reloaded.load();
    expect(reloaded.get(r2.id)?.title.en).toBe('Crêpes');
  });
});
