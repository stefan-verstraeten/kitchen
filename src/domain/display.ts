import { resolve, t, type ResolvedText } from './localized';
import { formatQuantity, quantityFor } from './quantity';
import type { Ingredient, Lang } from './types';
import { unitLabel } from './units';

/** Amount ("1½ el") and name of an ingredient for a given number of servings. */
export function displayIngredient(
  ing: Ingredient,
  servings: number,
  baseServings: number,
  lang: Lang,
): { amount: string; name?: ResolvedText; note: string } {
  const q = quantityFor(ing, servings, baseServings);
  const amount = q === undefined ? '' : formatQuantity(q, ing.unit, lang);
  const numeric = q === undefined ? undefined : typeof q === 'number' ? q : q.max;
  const unit = ing.unit ? unitLabel(ing.unit, lang, numeric) : t(ing.unitText, lang);
  return { amount: [amount, unit].filter(Boolean).join(' '), name: resolve(ing.name, lang), note: t(ing.note, lang) };
}
