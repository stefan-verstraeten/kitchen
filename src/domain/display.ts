import { formatQuantity, quantityFor } from './quantity';
import type { Ingredient } from './types';
import { unitLabel } from './units';

/** Amount ("1½ el") and name of an ingredient for a given number of servings. */
export function displayIngredient(ing: Ingredient, servings: number, baseServings: number): { amount: string; name: string; note: string } {
  const q = quantityFor(ing, servings, baseServings);
  const amount = q === undefined ? '' : formatQuantity(q, ing.unit);
  const numeric = q === undefined ? undefined : typeof q === 'number' ? q : q.max;
  const unit = ing.unit ? unitLabel(ing.unit, numeric) : ing.unitText;
  return { amount: [amount, unit].filter(Boolean).join(' '), name: ing.name, note: ing.note ?? '' };
}
