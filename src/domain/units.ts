import { fold } from './localized';
import type { Lang, Unit } from './types';

interface UnitInfo {
  /** Display: [singular, plural] per language. */
  label: Record<Lang, [string, string]>;
  /** Spellings recognised when parsing (folded, lower case). */
  aliases: string[];
}

export const UNIT_INFO: Record<Unit, UnitInfo> = {
  g: { label: { nl: ['g', 'g'], en: ['g', 'g'] }, aliases: ['g', 'gr', 'gram', 'grams', 'gramme'] },
  kg: { label: { nl: ['kg', 'kg'], en: ['kg', 'kg'] }, aliases: ['kg', 'kilo', 'kilogram', 'kilograms'] },
  mg: { label: { nl: ['mg', 'mg'], en: ['mg', 'mg'] }, aliases: ['mg', 'milligram'] },
  ml: { label: { nl: ['ml', 'ml'], en: ['ml', 'ml'] }, aliases: ['ml', 'milliliter', 'millilitre', 'milliliters'] },
  cl: { label: { nl: ['cl', 'cl'], en: ['cl', 'cl'] }, aliases: ['cl', 'centiliter'] },
  dl: { label: { nl: ['dl', 'dl'], en: ['dl', 'dl'] }, aliases: ['dl', 'deciliter'] },
  l: { label: { nl: ['l', 'l'], en: ['l', 'l'] }, aliases: ['l', 'liter', 'litre', 'liters', 'litres', 'ltr'] },
  tsp: {
    label: { nl: ['tl', 'tl'], en: ['tsp', 'tsp'] },
    aliases: ['tl', 'theelepel', 'theelepels', 'kl', 'koffielepel', 'koffielepels', 'tsp', 'teaspoon', 'teaspoons', 'tsps'],
  },
  tbsp: {
    label: { nl: ['el', 'el'], en: ['tbsp', 'tbsp'] },
    aliases: ['el', 'eetlepel', 'eetlepels', 'soeplepel', 'soeplepels', 'tbsp', 'tbs', 'tablespoon', 'tablespoons'],
  },
  cup: { label: { nl: ['kopje', 'kopjes'], en: ['cup', 'cups'] }, aliases: ['kop', 'kopje', 'kopjes', 'cup', 'cups'] },
  piece: {
    label: { nl: ['stuk', 'stuks'], en: ['piece', 'pieces'] },
    aliases: ['stuk', 'stuks', 'st', 'piece', 'pieces', 'pc', 'pcs'],
  },
  clove: {
    label: { nl: ['teentje', 'teentjes'], en: ['clove', 'cloves'] },
    aliases: ['teen', 'teentje', 'teentjes', 'tenen', 'clove', 'cloves'],
  },
  pinch: {
    label: { nl: ['snuifje', 'snuifjes'], en: ['pinch', 'pinches'] },
    aliases: ['snuif', 'snuifje', 'snuifjes', 'snufje', 'snufjes', 'mespunt', 'mespuntje', 'pinch', 'pinches'],
  },
  bunch: {
    label: { nl: ['bosje', 'bosjes'], en: ['bunch', 'bunches'] },
    aliases: ['bos', 'bosje', 'bosjes', 'bunch', 'bunches'],
  },
  sprig: {
    label: { nl: ['takje', 'takjes'], en: ['sprig', 'sprigs'] },
    aliases: ['tak', 'takje', 'takjes', 'sprig', 'sprigs'],
  },
  slice: {
    label: { nl: ['sneetje', 'sneetjes'], en: ['slice', 'slices'] },
    aliases: ['snee', 'sneetje', 'sneetjes', 'sneden', 'plak', 'plakje', 'plakjes', 'plakken', 'slice', 'slices'],
  },
  can: { label: { nl: ['blik', 'blikken'], en: ['can', 'cans'] }, aliases: ['blik', 'blikje', 'blikken', 'can', 'cans', 'tin', 'tins'] },
  jar: { label: { nl: ['pot', 'potten'], en: ['jar', 'jars'] }, aliases: ['pot', 'potje', 'potten', 'bokaal', 'jar', 'jars'] },
  pack: {
    label: { nl: ['pak', 'pakken'], en: ['pack', 'packs'] },
    aliases: ['pak', 'pakje', 'pakjes', 'pakken', 'zakje', 'zakjes', 'pack', 'packs', 'packet', 'packets', 'package'],
  },
  handful: {
    label: { nl: ['handvol', 'handvol'], en: ['handful', 'handfuls'] },
    aliases: ['handvol', 'handjevol', 'handful', 'handfuls'],
  },
  leaf: { label: { nl: ['blad', 'blaadjes'], en: ['leaf', 'leaves'] }, aliases: ['blad', 'blaadje', 'blaadjes', 'bladeren', 'leaf', 'leaves'] },
  stalk: {
    label: { nl: ['stengel', 'stengels'], en: ['stalk', 'stalks'] },
    aliases: ['stengel', 'stengels', 'stengeltje', 'stalk', 'stalks', 'stick', 'sticks'],
  },
  dash: { label: { nl: ['scheutje', 'scheutjes'], en: ['dash', 'dashes'] }, aliases: ['scheut', 'scheutje', 'scheutjes', 'dash', 'dashes', 'splash'] },
};

const ALIAS_TO_UNIT = new Map<string, Unit>();
for (const [unit, info] of Object.entries(UNIT_INFO) as [Unit, UnitInfo][]) {
  for (const alias of info.aliases) ALIAS_TO_UNIT.set(alias, unit);
}

export function unitFromText(text: string): Unit | undefined {
  return ALIAS_TO_UNIT.get(fold(text.replace(/\.$/, '')));
}

export function unitLabel(unit: Unit, lang: Lang, amount: number | undefined): string {
  const [singular, plural] = UNIT_INFO[unit].label[lang];
  return amount !== undefined && amount > 1 ? plural : singular;
}
