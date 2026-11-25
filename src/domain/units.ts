import { fold } from './text';
import type { Unit } from './types';

interface UnitInfo {
  /** Display: [singular, plural]. */
  label: [string, string];
  /** Spellings recognised when parsing (folded, lower case). English spellings are accepted too. */
  aliases: string[];
}

export const UNIT_INFO: Record<Unit, UnitInfo> = {
  g: { label: ['g', 'g'], aliases: ['g', 'gr', 'gram', 'grams', 'gramme'] },
  kg: { label: ['kg', 'kg'], aliases: ['kg', 'kilo', 'kilogram', 'kilograms'] },
  mg: { label: ['mg', 'mg'], aliases: ['mg', 'milligram'] },
  ml: { label: ['ml', 'ml'], aliases: ['ml', 'milliliter', 'millilitre', 'milliliters'] },
  cl: { label: ['cl', 'cl'], aliases: ['cl', 'centiliter'] },
  dl: { label: ['dl', 'dl'], aliases: ['dl', 'deciliter'] },
  l: { label: ['l', 'l'], aliases: ['l', 'liter', 'litre', 'liters', 'litres', 'ltr'] },
  tsp: {
    label: ['tl', 'tl'],
    aliases: ['tl', 'theelepel', 'theelepels', 'kl', 'koffielepel', 'koffielepels', 'tsp', 'teaspoon', 'teaspoons', 'tsps'],
  },
  tbsp: {
    label: ['el', 'el'],
    aliases: ['el', 'eetlepel', 'eetlepels', 'soeplepel', 'soeplepels', 'tbsp', 'tbs', 'tablespoon', 'tablespoons'],
  },
  cup: { label: ['kopje', 'kopjes'], aliases: ['kop', 'kopje', 'kopjes', 'cup', 'cups'] },
  piece: {
    label: ['stuk', 'stuks'],
    aliases: ['stuk', 'stuks', 'st', 'piece', 'pieces', 'pc', 'pcs'],
  },
  clove: {
    label: ['teentje', 'teentjes'],
    aliases: ['teen', 'teentje', 'teentjes', 'tenen', 'clove', 'cloves'],
  },
  pinch: {
    label: ['snuifje', 'snuifjes'],
    aliases: ['snuif', 'snuifje', 'snuifjes', 'snufje', 'snufjes', 'mespunt', 'mespuntje', 'pinch', 'pinches'],
  },
  bunch: {
    label: ['bosje', 'bosjes'],
    aliases: ['bos', 'bosje', 'bosjes', 'bunch', 'bunches'],
  },
  sprig: {
    label: ['takje', 'takjes'],
    aliases: ['tak', 'takje', 'takjes', 'sprig', 'sprigs'],
  },
  slice: {
    label: ['sneetje', 'sneetjes'],
    aliases: ['snee', 'sneetje', 'sneetjes', 'sneden', 'plak', 'plakje', 'plakjes', 'plakken', 'slice', 'slices'],
  },
  can: { label: ['blik', 'blikken'], aliases: ['blik', 'blikje', 'blikken', 'can', 'cans', 'tin', 'tins'] },
  jar: { label: ['pot', 'potten'], aliases: ['pot', 'potje', 'potten', 'bokaal', 'jar', 'jars'] },
  pack: {
    label: ['pak', 'pakken'],
    aliases: ['pak', 'pakje', 'pakjes', 'pakken', 'zakje', 'zakjes', 'pack', 'packs', 'packet', 'packets', 'package'],
  },
  handful: {
    label: ['handvol', 'handvol'],
    aliases: ['handvol', 'handjevol', 'handful', 'handfuls'],
  },
  leaf: { label: ['blad', 'blaadjes'], aliases: ['blad', 'blaadje', 'blaadjes', 'bladeren', 'leaf', 'leaves'] },
  stalk: {
    label: ['stengel', 'stengels'],
    aliases: ['stengel', 'stengels', 'stengeltje', 'stalk', 'stalks', 'stick', 'sticks'],
  },
  dash: { label: ['scheutje', 'scheutjes'], aliases: ['scheut', 'scheutje', 'scheutjes', 'dash', 'dashes', 'splash'] },
};

const ALIAS_TO_UNIT = new Map<string, Unit>();
for (const [unit, info] of Object.entries(UNIT_INFO) as [Unit, UnitInfo][]) {
  for (const alias of info.aliases) ALIAS_TO_UNIT.set(alias, unit);
}

export function unitFromText(text: string): Unit | undefined {
  return ALIAS_TO_UNIT.get(fold(text.replace(/\.$/, '')));
}

export function unitLabel(unit: Unit, amount: number | undefined): string {
  const [singular, plural] = UNIT_INFO[unit].label;
  return amount !== undefined && amount > 1 ? plural : singular;
}
