import { parseIngredientLine } from './ingredientLine';
import { t } from './localized';
import { formatQuantity } from './quantity';
import { parseThermomixSettings } from './thermomix';
import type { Ingredient, IngredientGroup, Lang, Localized, Recipe, Step } from './types';
import { unitLabel } from './units';

/**
 * Helpers for the recipe editor. The editor works in one language at a time.
 * Text that the user leaves unchanged keeps its translation; text that is
 * changed keeps only the edited language, so the recipe is flagged as
 * "not translated" until it is translated again.
 */

/** Replace one language of a localized text; drops the other language when the text changed. */
export function editLocalized(old: Localized | undefined, lang: Lang, text: string): Localized | undefined {
  const value = text.trim();
  if ((old?.[lang] ?? '').trim() === value) return old;
  return value ? { [lang]: value } : undefined;
}

const OPTIONAL_LABEL: Record<Lang, string> = { nl: 'optioneel', en: 'optional' };

/** One editable line per ingredient, e.g. "200 g bloem, gezeefd (optioneel)". */
export function formatIngredientLine(ing: Ingredient, lang: Lang): string {
  const parts: string[] = [];
  if (ing.quantity !== undefined) parts.push(formatQuantity(ing.quantity, ing.unit, lang));
  const numeric = ing.quantity === undefined ? undefined : typeof ing.quantity === 'number' ? ing.quantity : ing.quantity.max;
  if (ing.unit) parts.push(unitLabel(ing.unit, lang, numeric));
  else if (ing.unitText) parts.push(t(ing.unitText, lang));
  parts.push(t(ing.name, lang));
  let line = parts.filter(Boolean).join(' ');
  const note = t(ing.note, lang);
  if (note) line += `, ${note}`;
  if (ing.optional && !new RegExp(OPTIONAL_LABEL[lang], 'i').test(note)) line += ` (${OPTIONAL_LABEL[lang]})`;
  return line;
}

export function ingredientsToText(group: IngredientGroup, lang: Lang): string {
  return group.items.map((i) => formatIngredientLine(i, lang)).join('\n');
}

/**
 * Turn edited text (one ingredient per line) back into ingredients.
 * Lines identical to an existing ingredient's line keep that ingredient as is
 * (including its translation and key); other lines are parsed afresh.
 */
export function textToIngredients(text: string, previous: Ingredient[], lang: Lang): Ingredient[] {
  const byLine = new Map<string, Ingredient[]>();
  for (const ing of previous) {
    const line = formatIngredientLine(ing, lang);
    byLine.set(line, [...(byLine.get(line) ?? []), ing]);
  }
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const kept = byLine.get(line)?.shift();
      if (kept) return kept;
      const parsed = parseIngredientLine(line, lang);
      delete parsed.raw;
      return parsed;
    });
}

/** Update a step's text; Thermomix settings are re-read from the new text. */
export function editStep(old: Step | undefined, lang: Lang, text: string): Step | undefined {
  const value = text.trim();
  if (!value) return undefined;
  if (old && (old.text[lang] ?? '').trim() === value) return old;
  const tm = parseThermomixSettings(value);
  return tm.length ? { text: { [lang]: value }, thermomix: tm } : { text: { [lang]: value } };
}

function fill(existing: Localized | undefined, translated: Localized | undefined): Localized | undefined {
  if (!existing) return translated;
  return { ...translated, ...Object.fromEntries(Object.entries(existing).filter(([, v]) => v?.trim())) };
}

/**
 * Merge a machine-translated version into the original recipe: only missing
 * languages are taken from the translation; existing texts, quantities, units
 * and Thermomix settings stay exactly as they were. Falls back to the
 * translated structure for a group whose item count differs.
 */
export function fillTranslations(original: Recipe, translated: Recipe): Recipe {
  const ingredientGroups =
    original.ingredientGroups.length === translated.ingredientGroups.length
      ? original.ingredientGroups.map((g, gi) => {
          const tg = translated.ingredientGroups[gi];
          if (g.items.length !== tg.items.length) return tg;
          return {
            title: fill(g.title, tg.title),
            items: g.items.map((i, ii) => {
              const ti = tg.items[ii];
              return {
                ...i,
                key: i.key ?? ti.key,
                name: fill(i.name, ti.name) ?? {},
                note: fill(i.note, ti.note),
                unitText: i.unitText ? fill(i.unitText, ti.unitText) : undefined,
              };
            }),
          };
        })
      : translated.ingredientGroups;
  const stepGroups =
    original.stepGroups.length === translated.stepGroups.length
      ? original.stepGroups.map((g, gi) => {
          const tg = translated.stepGroups[gi];
          if (g.steps.length !== tg.steps.length) return tg;
          return { title: fill(g.title, tg.title), steps: g.steps.map((s, si) => ({ ...s, text: fill(s.text, tg.steps[si].text) ?? {} })) };
        })
      : translated.stepGroups;
  const tNotes = translated.notes.filter((n) => n.origin === 'source');
  const sourceNotes = original.notes.filter((n) => n.origin === 'source');
  const notes =
    tNotes.length === sourceNotes.length
      ? original.notes.map((n) => {
          const idx = sourceNotes.indexOf(n);
          return idx >= 0 ? { ...n, text: fill(n.text, tNotes[idx].text) } : n;
        })
      : original.notes;
  return {
    ...original,
    title: fill(original.title, translated.title) ?? {},
    description: fill(original.description, translated.description),
    ingredientGroups,
    stepGroups,
    notes,
  };
}
