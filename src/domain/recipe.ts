import { slugify } from './text';
import { BASE_SERVINGS, SCHEMA_VERSION, type Note, type Recipe } from './types';

export function newId(title: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const slug = slugify(title) || 'recept';
  return `${slug}-${rand}`;
}

export function noteId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function emptyRecipe(title = ''): Recipe {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(title),
    title,
    servings: BASE_SERVINGS,
    thermomix: false,
    ingredientGroups: [{ items: [] }],
    stepGroups: [{ steps: [] }],
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addCookedDate(recipe: Recipe, date = todayIso()): Recipe {
  const note: Note = { id: noteId(), kind: 'cooked', date, origin: 'user' };
  return touch({ ...recipe, notes: [...recipe.notes, note] });
}

export function addNote(recipe: Recipe, text: string, opts: { date?: string; kind?: 'note' | 'tip' } = {}): Recipe {
  const note: Note = { id: noteId(), kind: opts.kind ?? 'note', text, date: opts.date, origin: 'user' };
  return touch({ ...recipe, notes: [...recipe.notes, note] });
}

export function removeNote(recipe: Recipe, id: string): Recipe {
  return touch({ ...recipe, notes: recipe.notes.filter((n) => n.id !== id) });
}

export function touch(recipe: Recipe): Recipe {
  return { ...recipe, updatedAt: new Date().toISOString() };
}

export function cookedDates(recipe: Recipe): string[] {
  return recipe.notes
    .filter((n) => n.kind === 'cooked' && n.date)
    .map((n) => n.date!)
    .sort()
    .reverse();
}

/**
 * Merge two versions of the same recipe (e.g. after a Dropbox conflict).
 * The newest version wins for content; notes from both sides are kept so a
 * "cooked on" entry added on another device is never lost.
 */
export function mergeRecipes(a: Recipe, b: Recipe): Recipe {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a];
  const notes = new Map<string, Note>();
  for (const n of [...older.notes, ...newer.notes]) notes.set(n.id, n);
  return { ...newer, notes: [...notes.values()] };
}

/** Light validation for files read from Dropbox. */
export function isRecipe(value: unknown): value is Recipe {
  const r = value as Recipe;
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    Array.isArray(r.ingredientGroups) &&
    Array.isArray(r.stepGroups) &&
    Array.isArray(r.notes)
  );
}

type OldText = string | { nl?: string; en?: string } | undefined;

/** Version 1 stored {nl, en} pairs; keep the Dutch text (or English when there is no Dutch). */
function single(v: OldText): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') return v;
  return v.nl?.trim() || v.en?.trim() || undefined;
}

/**
 * Read a recipe file in any supported format and return it in the current
 * format, or undefined if it is not a recipe.
 */
export function upgradeRecipe(value: unknown): Recipe | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as Record<string, unknown> & { schemaVersion?: number };
  if (r.schemaVersion === SCHEMA_VERSION) return isRecipe(r) ? r : undefined;
  if (r.schemaVersion !== 1) return undefined;
  const old = r as any;
  const upgraded = {
    ...old,
    schemaVersion: SCHEMA_VERSION,
    title: single(old.title) ?? '',
    description: single(old.description),
    tags: old.tags?.map(single).filter(Boolean),
    ingredientGroups: (old.ingredientGroups ?? []).map((g: any) => ({
      title: single(g.title),
      items: (g.items ?? []).map((i: any) => ({
        ...i,
        name: single(i.name) ?? '',
        unitText: single(i.unitText),
        note: single(i.note),
      })),
    })),
    stepGroups: (old.stepGroups ?? []).map((g: any) => ({
      title: single(g.title),
      steps: (g.steps ?? []).map((st: any) => ({ ...st, text: single(st.text) ?? '' })),
    })),
    notes: (old.notes ?? []).map((n: any) => ({ ...n, text: single(n.text) })),
  };
  delete upgraded.originalLanguage;
  return isRecipe(upgraded) ? upgraded : undefined;
}
