import { parseIngredientLine } from './ingredientLine';
import { formatQuantity } from './quantity';
import { parseThermomixSettings } from './thermomix';
import type { Ingredient, IngredientGroup, Step } from './types';
import { unitLabel } from './units';

/** One editable line per ingredient, e.g. "200 g bloem, gezeefd (optioneel)". */
export function formatIngredientLine(ing: Ingredient): string {
  const parts: string[] = [];
  if (ing.quantity !== undefined) parts.push(formatQuantity(ing.quantity, ing.unit));
  const numeric = ing.quantity === undefined ? undefined : typeof ing.quantity === 'number' ? ing.quantity : ing.quantity.max;
  if (ing.unit) parts.push(unitLabel(ing.unit, numeric));
  else if (ing.unitText) parts.push(ing.unitText);
  parts.push(ing.name);
  let line = parts.filter(Boolean).join(' ');
  if (ing.note) line += `, ${ing.note}`;
  if (ing.optional && !/optioneel/i.test(ing.note ?? '')) line += ' (optioneel)';
  return line;
}

export function ingredientsToText(group: IngredientGroup): string {
  return group.items.map(formatIngredientLine).join('\n');
}

/**
 * Turn edited text (one ingredient per line) back into ingredients.
 * Lines identical to an existing ingredient's line keep that ingredient as is
 * (including e.g. a free-text unit); other lines are parsed afresh.
 */
export function textToIngredients(text: string, previous: Ingredient[]): Ingredient[] {
  const byLine = new Map<string, Ingredient[]>();
  for (const ing of previous) {
    const line = formatIngredientLine(ing);
    byLine.set(line, [...(byLine.get(line) ?? []), ing]);
  }
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const kept = byLine.get(line)?.shift();
      if (kept) return kept;
      const parsed = parseIngredientLine(line);
      delete parsed.raw;
      return parsed;
    });
}

/** Update a step's text; Thermomix settings are re-read when the text changed. */
export function editStep(old: Step | undefined, text: string): Step | undefined {
  const value = text.trim();
  if (!value) return undefined;
  if (old && old.text.trim() === value) return old;
  const tm = parseThermomixSettings(value);
  return tm.length ? { text: value, thermomix: tm } : { text: value };
}
