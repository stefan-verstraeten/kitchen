import { describe, expect, it } from 'vitest';

import { editLocalized, editStep, fillTranslations, formatIngredientLine, ingredientsToText, textToIngredients } from '../src/domain/editing';
import { parseIngredientLine } from '../src/domain/ingredientLine';
import { emptyRecipe } from '../src/domain/recipe';
import type { Ingredient } from '../src/domain/types';
import { recipeToHtml } from '../src/export/recipeHtml';

const bilingual: Ingredient[] = [
  { key: 'flour', name: { nl: 'bloem', en: 'flour' }, quantity: 200, unit: 'g', note: { nl: 'gezeefd', en: 'sifted' } },
  { key: 'garlic', name: { nl: 'look', en: 'garlic' }, quantity: { min: 1, max: 2 }, unit: 'clove', optional: true },
  { key: 'salt-and-pepper', name: { nl: 'zout en peper', en: 'salt and pepper' }, scalable: false },
  { key: 'olive-oil', name: { nl: 'olijfolie', en: 'olive oil' }, quantity: 1.5, unit: 'tbsp' },
];

describe('editor ingredient text', () => {
  it('formats one line per ingredient', () => {
    expect(ingredientsToText({ items: bilingual }, 'nl')).toBe('200 g bloem, gezeefd\n1–2 teentjes look (optioneel)\nzout en peper\n1½ el olijfolie');
    expect(formatIngredientLine(bilingual[1], 'en')).toBe('1–2 cloves garlic (optional)');
  });

  it('keeps unchanged lines (with translations) and parses changed ones', () => {
    const text = ingredientsToText({ items: bilingual }, 'nl').replace('200 g bloem', '250 g bloem') + '\n- 2 uien';
    const result = textToIngredients(text, bilingual, 'nl');
    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({ quantity: 250, unit: 'g', name: { nl: 'bloem' }, key: 'flour' });
    expect(result[0].name.en).toBeUndefined(); // changed -> needs translation again
    expect(result[1]).toBe(bilingual[1]);
    expect(result[3]).toBe(bilingual[3]);
    expect(result[4]).toMatchObject({ quantity: 2, key: 'onion' });
  });

  it('formatted lines parse back to the same values', () => {
    for (const lang of ['nl', 'en'] as const) {
      for (const ing of bilingual) {
        const parsed = parseIngredientLine(formatIngredientLine(ing, lang), lang);
        expect(parsed.quantity).toEqual(ing.quantity);
        expect(parsed.unit).toEqual(ing.unit);
        expect(parsed.name[lang]).toBe(ing.name[lang]);
      }
    }
  });
});

describe('editing texts and steps', () => {
  it('drops the other language only when the text changes', () => {
    const v = { nl: 'Soep', en: 'Soup' };
    expect(editLocalized(v, 'nl', ' Soep ')).toBe(v);
    expect(editLocalized(v, 'nl', 'Tomatensoep')).toEqual({ nl: 'Tomatensoep' });
    expect(editLocalized(v, 'nl', '')).toBeUndefined();
  });

  it('re-reads Thermomix settings from edited steps', () => {
    const step = editStep(undefined, 'nl', 'Mix 10 sec./snelheid 7.');
    expect(step?.thermomix?.[0]).toMatchObject({ timeSeconds: 10, speed: 7 });
  });

  it('fills only missing translations', () => {
    const original = emptyRecipe('nl', 'Soep');
    original.title = { nl: 'Mijn soep' };
    original.ingredientGroups = [{ items: [{ ...bilingual[0], name: { nl: 'bloem' }, quantity: 210 }] }];
    original.stepGroups = [{ steps: [{ text: { nl: 'Roer 5 sec./snelheid 3.' }, thermomix: [{ timeSeconds: 5, speed: 3 }] }] }];
    const translated = {
      ...original,
      title: { nl: 'Soep (herschreven)', en: 'My soup' },
      ingredientGroups: [{ items: [{ ...bilingual[0], quantity: 999 }] }],
      stepGroups: [{ steps: [{ text: { nl: 'anders', en: 'Stir 5 sec/speed 3.' } }] }],
    };
    const merged = fillTranslations(original, translated);
    expect(merged.title).toEqual({ nl: 'Mijn soep', en: 'My soup' });
    expect(merged.ingredientGroups[0].items[0]).toMatchObject({ quantity: 210, name: { nl: 'bloem', en: 'flour' } });
    expect(merged.stepGroups[0].steps[0]).toMatchObject({ text: { nl: 'Roer 5 sec./snelheid 3.', en: 'Stir 5 sec/speed 3.' }, thermomix: [{ speed: 3 }] });
  });
});

describe('PDF html', () => {
  it('renders scaled ingredients, Thermomix settings, notes and source, escaped', () => {
    const r = emptyRecipe('nl', 'x');
    r.title = { nl: 'Soep <met> balletjes', en: 'Soup' };
    r.thermomix = true;
    r.ingredientGroups = [{ items: bilingual }];
    r.stepGroups = [{ steps: [{ text: { nl: 'Kook.' }, thermomix: [{ timeSeconds: 600, temperature: 100, speed: 1 }] }] }];
    r.notes = [
      { id: 'a', kind: 'cooked', date: '2026-11-16', origin: 'user' },
      { id: 'b', kind: 'note', text: { nl: 'Prive notitie' }, origin: 'user' },
    ];
    r.source = { url: 'https://dagelijksekost.vrt.be/x', author: 'Jeroen Meus', siteName: 'Dagelijkse Kost', importedAt: '' };
    const html = recipeToHtml(r, { lang: 'nl', servings: 8 });
    expect(html).toContain('Soep &lt;met&gt; balletjes');
    expect(html).toContain('400 g');
    expect(html).toContain('voor 8 personen');
    expect(html).toContain('10 min / 100 °C / snelheid 1');
    expect(html).toContain('Prive notitie');
    expect(html).toContain('Jeroen Meus');
    expect(recipeToHtml(r, { lang: 'nl', servings: 4, includeNotes: false })).not.toContain('Prive notitie');
  });
});
