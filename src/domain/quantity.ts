import type { Ingredient, Quantity, Unit } from './types';

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 0.2,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

/** Number pattern accepting "1", "1.5", "1,5", "1/2", "1 1/2", "1½", "½". */
export const NUMBER_PATTERN = String.raw`(?:\d+(?:[.,]\d+)?(?:\s*[¼½¾⅓⅔⅕⅛⅜⅝⅞])?|\d+\s+\d+\/\d+|\d+\/\d+|[¼½¾⅓⅔⅕⅛⅜⅝⅞])`;

export function parseNumber(input: string): number | undefined {
  const s = input.trim();
  if (!s) return undefined;
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = /^(\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[1]) / Number(m[2]);
  m = /^(\d+(?:[.,]\d+)?)?\s*([¼½¾⅓⅔⅕⅛⅜⅝⅞])$/.exec(s);
  if (m) return (m[1] ? Number(m[1].replace(',', '.')) : 0) + UNICODE_FRACTIONS[m[2]];
  m = /^\d+(?:[.,]\d+)?$/.exec(s);
  if (m) return Number(s.replace(',', '.'));
  return undefined;
}

/** Parse "2", "2-3", "2 à 3", "2 to 3", "2 tot 3". */
export function parseQuantity(input: string): Quantity | undefined {
  const range = new RegExp(
    `^(${NUMBER_PATTERN})\\s*(?:-|–|—|à|a|tot|to|or|of)\\s*(${NUMBER_PATTERN})$`,
    'i',
  ).exec(input.trim());
  if (range) {
    const min = parseNumber(range[1]);
    const max = parseNumber(range[2]);
    if (min !== undefined && max !== undefined) return { min, max };
  }
  return parseNumber(input);
}

export function scaleQuantity(q: Quantity, factor: number): Quantity {
  return typeof q === 'number' ? q * factor : { min: q.min * factor, max: q.max * factor };
}

/** Normalize a quantity given for `fromServings` to `toServings`. */
export function normalizeQuantity(q: Quantity, fromServings: number, toServings: number): Quantity {
  if (!fromServings || fromServings === toServings) return q;
  return scaleQuantity(q, toServings / fromServings);
}

// Units measured with spoons / pieces read best as kitchen fractions.
const FRACTION_UNITS = new Set<Unit | undefined>([
  undefined,
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'clove',
  'can',
  'jar',
  'pack',
  'handful',
  'bunch',
  'sprig',
  'slice',
  'leaf',
  'stalk',
]);

const NICE_FRACTIONS: [number, string][] = [
  [0, ''],
  [0.125, '⅛'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [1, ''],
];

function formatFraction(n: number): string {
  let whole = Math.floor(n);
  const frac = n - whole;
  let best = NICE_FRACTIONS[0];
  for (const cand of NICE_FRACTIONS) {
    if (Math.abs(cand[0] - frac) < Math.abs(best[0] - frac)) best = cand;
  }
  if (best[0] === 1) whole += 1;
  if (whole === 0 && best[1] === '') return n > 0 ? '⅛' : '0';
  return whole === 0 ? best[1] : `${whole}${best[1]}`;
}

/** Round weights/volumes to sensible kitchen precision. */
function formatMetric(n: number): string {
  let rounded: number;
  if (n >= 100) rounded = Math.round(n / 5) * 5;
  else if (n >= 10) rounded = Math.round(n);
  else rounded = Math.round(n * 10) / 10;
  return String(rounded).replace('.', ',');
}

export function formatNumber(n: number, unit: Unit | undefined): string {
  return FRACTION_UNITS.has(unit) ? formatFraction(n) : formatMetric(n);
}

export function formatQuantity(q: Quantity, unit: Unit | undefined): string {
  if (typeof q === 'number') return formatNumber(q, unit);
  const min = formatNumber(q.min, unit);
  const max = formatNumber(q.max, unit);
  return min === max ? min : `${min}–${max}`;
}

/** Quantity of an ingredient for `servings` people (stored values are for `baseServings`). */
export function quantityFor(
  ingredient: Ingredient,
  servings: number,
  baseServings: number,
): Quantity | undefined {
  if (ingredient.quantity === undefined) return undefined;
  if (ingredient.scalable === false) return ingredient.quantity;
  return scaleQuantity(ingredient.quantity, servings / baseServings);
}

/** Extract a servings count from strings like "4 personen", "Serves 6", "6-8 porties". */
export function parseServings(input: unknown): number | undefined {
  const values = Array.isArray(input) ? input : [input];
  for (const v of values) {
    if (typeof v === 'number' && v > 0) return v;
    if (typeof v !== 'string') continue;
    const m = /(\d+)(?:\s*(?:-|–|tot|to|à)\s*(\d+))?/.exec(v);
    if (m) return Number(m[1]);
  }
  return undefined;
}
