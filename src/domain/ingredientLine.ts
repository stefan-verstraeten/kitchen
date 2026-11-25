import { NUMBER_PATTERN, parseQuantity } from './quantity';
import { unitFromText } from './units';
import type { Ingredient } from './types';
import { ingredientKeyFor } from './ingredientCatalog';

const OPTIONAL_RE = /\b(optioneel|facultatief|naar keuze|optional|if desired)\b/i;
const TO_TASTE_RE = /\b(naar smaak|to taste|zout en peper|salt and pepper|peper en zout)\b/i;

const LEADING_QTY = new RegExp(
  `^(${NUMBER_PATTERN}(?:\\s*(?:-|–|—|à|tot|to|or|of)\\s*${NUMBER_PATTERN})?)\\s*`,
  'i',
);

/**
 * Parse a free-text ingredient line such as
 *   "200 g bloem", "2 uien, fijngesnipperd", "1-2 teentjes look (optioneel)",
 *   "2 tbsp olive oil, divided", "zout en peper".
 * The quantity is returned as written; normalizing to BASE_SERVINGS happens later.
 */
export function parseIngredientLine(line: string): Ingredient {
  const raw = line.replace(/\s+/g, ' ').trim();
  let rest = raw;
  const result: Ingredient = { name: '', raw };

  const qtyMatch = LEADING_QTY.exec(rest);
  if (qtyMatch) {
    const q = parseQuantity(qtyMatch[1]);
    if (q !== undefined) {
      result.quantity = q;
      rest = rest.slice(qtyMatch[0].length);
    }
  }

  // Unit: either glued to the number ("200g") or the next word.
  const unitMatch = /^([A-Za-zÀ-ÿ]+\.?)(?:\s+|$)/.exec(rest);
  if (unitMatch) {
    const unit = unitFromText(unitMatch[1]);
    if (unit) {
      result.unit = unit;
      rest = rest.slice(unitMatch[0].length);
      // "200 g of flour" / "2 el van de olie"
      rest = rest.replace(/^(of|van)\s+/i, '');
    }
  }

  const notes: string[] = [];
  rest = rest.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    notes.push(inner.trim());
    return ' ';
  });
  const commaIdx = rest.indexOf(',');
  if (commaIdx > 0) {
    notes.push(rest.slice(commaIdx + 1).trim());
    rest = rest.slice(0, commaIdx);
  }

  const name = rest.replace(/\s+/g, ' ').trim();
  result.name = name || raw;
  const note = notes.filter(Boolean).join(', ');
  if (note) result.note = note;
  if (OPTIONAL_RE.test(raw)) result.optional = true;
  if (TO_TASTE_RE.test(raw) && result.quantity === undefined) result.scalable = false;
  if (result.unit === 'pinch' || result.unit === 'dash') result.scalable = false;

  const key = ingredientKeyFor(name);
  if (key) result.key = key;
  return result;
}
