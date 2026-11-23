import { slugify } from './localized';
import { BASE_SERVINGS, SCHEMA_VERSION, type Lang, type Localized, type Note, type Recipe } from './types';

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

export function emptyRecipe(lang: Lang, title = ''): Recipe {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(title),
    title: { [lang]: title },
    originalLanguage: lang,
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

export function addNote(recipe: Recipe, text: Localized, opts: { date?: string; kind?: 'note' | 'tip' } = {}): Recipe {
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
    typeof r.title === 'object' &&
    Array.isArray(r.ingredientGroups) &&
    Array.isArray(r.stepGroups) &&
    Array.isArray(r.notes)
  );
}

/** Languages that are fully present for title, ingredients and steps. */
export function availableLanguages(recipe: Recipe): Lang[] {
  const langs: Lang[] = ['nl', 'en'];
  return langs.filter(
    (l) =>
      !!recipe.title[l] &&
      recipe.ingredientGroups.every((g) => g.items.every((i) => !!i.name[l])) &&
      recipe.stepGroups.every((g) => g.steps.every((s) => !!s.text[l])),
  );
}
