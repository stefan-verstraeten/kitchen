import { catalogEntry } from './ingredientCatalog';
import { fold, t } from './localized';
import type { Lang, Localized, Recipe } from './types';

export interface IndexEntry {
  /** Catalog key, or "name:<folded name>" for ingredients not in the catalog. */
  key: string;
  name: Localized;
  recipeIds: string[];
}

export function indexKeyFor(ing: { key?: string; name: Localized }): string {
  if (ing.key) return ing.key;
  return `name:${fold(ing.name.en ?? ing.name.nl ?? '')}`;
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
          const cat = ing.key ? catalogEntry(ing.key) : undefined;
          entry = { key, name: cat ? { ...cat.name } : { ...ing.name }, recipeIds: [] };
          map.set(key, entry);
        } else if (!ing.key) {
          // Fill in a missing translation from another recipe.
          entry.name = { ...ing.name, ...entry.name };
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
 * Search the index in either language (accent/case-insensitive), so a Dutch
 * user typing "ui" and an English user typing "onion" find the same entry.
 * Results are sorted by display name in `lang`.
 */
export function searchIngredientIndex(index: IndexEntry[], query: string, lang: Lang): IndexEntry[] {
  const q = fold(query);
  const matches = q
    ? index.filter((e) => {
        const names = [e.name.nl, e.name.en, ...(catalogEntry(e.key)?.synonyms ?? [])];
        return names.some((n) => n && matchesQuery(fold(n), q));
      })
    : index;
  return [...matches].sort((a, b) => {
    if (q) {
      // Prefix matches first.
      const ap = fold(t(a.name, lang)).startsWith(q) ? 0 : 1;
      const bp = fold(t(b.name, lang)).startsWith(q) ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    return t(a.name, lang).localeCompare(t(b.name, lang), lang);
  });
}

/** Free-text recipe search over titles and ingredient names in both languages. */
export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  const q = fold(query);
  if (!q) return recipes;
  const terms = q.split(' ');
  return recipes.filter((r) => {
    const hay = fold(
      [
        r.title.nl,
        r.title.en,
        r.source?.author,
        r.source?.siteName,
        ...r.ingredientGroups.flatMap((g) => g.items.flatMap((i) => [i.name.nl, i.name.en])),
        ...(r.tags ?? []).flatMap((tag) => [tag.nl, tag.en]),
      ]
        .filter(Boolean)
        .join(' '),
    );
    return terms.every((term) => hay.includes(term));
  });
}
