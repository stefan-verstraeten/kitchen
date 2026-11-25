import { catalogEntry } from './ingredientCatalog';
import { fold } from './text';
import type { Recipe } from './types';

export interface IndexEntry {
  /** Catalog key, or "name:<folded name>" for ingredients not in the catalog. */
  key: string;
  name: string;
  recipeIds: string[];
}

export function indexKeyFor(ing: { key?: string; name: string }): string {
  return ing.key ?? `name:${fold(ing.name)}`;
}

/** Build the ingredient index (ingredient -> recipes) from all recipes. */
export function buildIngredientIndex(recipes: Recipe[]): IndexEntry[] {
  const map = new Map<string, IndexEntry>();
  for (const recipe of recipes) {
    for (const group of recipe.ingredientGroups) {
      for (const ing of group.items) {
        const key = indexKeyFor(ing);
        if (key === 'name:') continue;
        let entry = map.get(key);
        if (!entry) {
          entry = { key, name: (ing.key && catalogEntry(ing.key)?.name) || ing.name, recipeIds: [] };
          map.set(key, entry);
        }
        if (!entry.recipeIds.includes(recipe.id)) entry.recipeIds.push(recipe.id);
      }
    }
  }
  return [...map.values()];
}

/**
 * A name matches when one of its words starts with the query ("ui" -> "uien"),
 * or, for longer queries, when it occurs anywhere ("gehakt" -> "rundergehakt").
 */
function matchesQuery(foldedName: string, q: string): boolean {
  if (foldedName.startsWith(q) || foldedName.includes(` ${q}`)) return true;
  return q.length >= 4 && foldedName.includes(q);
}

/**
 * Search the index (accent/case-insensitive). Catalog synonyms count too, so
 * "ajuin" finds the entry "ui". Results are sorted alphabetically, with names
 * starting with the query first.
 */
export function searchIngredientIndex(index: IndexEntry[], query: string): IndexEntry[] {
  const q = fold(query);
  const matches = q
    ? index.filter((e) => [e.name, ...(catalogEntry(e.key)?.synonyms ?? [])].some((n) => matchesQuery(fold(n), q)))
    : index;
  return [...matches].sort((a, b) => {
    if (q) {
      const ap = fold(a.name).startsWith(q) ? 0 : 1;
      const bp = fold(b.name).startsWith(q) ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    return a.name.localeCompare(b.name, 'nl');
  });
}

/** Free-text recipe search over titles, cooks, sites, ingredients and tags. */
export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  const q = fold(query);
  if (!q) return recipes;
  const terms = q.split(' ');
  return recipes.filter((r) => {
    const hay = fold(
      [
        r.title,
        r.source?.author,
        r.source?.siteName,
        ...r.ingredientGroups.flatMap((g) => g.items.map((i) => i.name)),
        ...(r.tags ?? []),
      ]
        .filter(Boolean)
        .join(' '),
    );
    return terms.every((term) => hay.includes(term));
  });
}
