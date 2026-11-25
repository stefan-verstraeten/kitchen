import { describe, expect, it } from 'vitest';

import { editStep, formatIngredientLine, ingredientsToText, textToIngredients } from '../src/domain/editing';
import { parseIngredientLine } from '../src/domain/ingredientLine';
import { emptyRecipe } from '../src/domain/recipe';
import type { Ingredient } from '../src/domain/types';
import { recipeToHtml } from '../src/export/recipeHtml';

const items: Ingredient[] = [
  { key: 'flour', name: 'bloem', quantity: 200, unit: 'g', note: 'gezeefd' },
  { key: 'garlic', name: 'look', quantity: { min: 1, max: 2 }, unit: 'clove', optional: true },
  { key: 'salt-and-pepper', name: 'zout en peper', scalable: false },
  { key: 'olive-oil', name: 'olijfolie', quantity: 1.5, unit: 'tbsp' },
  { name: 'gist', quantity: 1, unitText: 'bolletje' },
];

describe('editor ingredient text', () => {
  it('formats one line per ingredient', () => {
    expect(ingredientsToText({ items })).toBe(
      '200 g bloem, gezeefd\n1–2 teentjes look (optioneel)\nzout en peper\n1½ el olijfolie\n1 bolletje gist',
    );
  });

  it('keeps unchanged lines and parses changed ones', () => {
    const text = ingredientsToText({ items }).replace('200 g bloem', '250 g bloem') + '\n- 2 uien';
    const result = textToIngredients(text, items);
    expect(result).toHaveLength(6);
    expect(result[0]).toMatchObject({ quantity: 250, unit: 'g', name: 'bloem', note: 'gezeefd', key: 'flour' });
    expect(result[1]).toBe(items[1]);
    expect(result[4]).toBe(items[4]); // free-text unit survives unchanged
    expect(result[5]).toMatchObject({ quantity: 2, name: 'uien', key: 'onion' });
  });

  it('formatted lines parse back to the same values', () => {
    for (const ing of items.slice(0, 4)) {
      const parsed = parseIngredientLine(formatIngredientLine(ing));
      expect(parsed.quantity).toEqual(ing.quantity);
      expect(parsed.unit).toEqual(ing.unit);
      expect(parsed.name).toBe(ing.name);
    }
  });
});

describe('editing steps', () => {
  it('keeps unchanged steps and re-reads Thermomix settings from edited ones', () => {
    const old = { text: 'Roer.', thermomix: [] };
    expect(editStep(old, ' Roer. ')).toBe(old);
    expect(editStep(old, 'Mix 10 sec./snelheid 7.')?.thermomix?.[0]).toMatchObject({ timeSeconds: 10, speed: 7 });
    expect(editStep(old, '  ')).toBeUndefined();
  });
});

describe('PDF html', () => {
  it('renders scaled ingredients, Thermomix settings, notes and source, escaped', () => {
    const r = emptyRecipe('x');
    r.title = 'Soep <met> balletjes';
    r.thermomix = true;
    r.ingredientGroups = [{ items }];
    r.stepGroups = [{ steps: [{ text: 'Kook.', thermomix: [{ timeSeconds: 600, temperature: 100, speed: 1 }] }] }];
    r.notes = [
      { id: 'a', kind: 'cooked', date: '2026-11-16', origin: 'user' },
      { id: 'b', kind: 'note', text: 'Prive notitie', origin: 'user' },
    ];
    r.source = { url: 'https://dagelijksekost.vrt.be/x', author: 'Jeroen Meus', siteName: 'Dagelijkse Kost', importedAt: '' };
    const html = recipeToHtml(r, { servings: 8 });
    expect(html).toContain('Soep &lt;met&gt; balletjes');
    expect(html).toContain('400 g');
    expect(html).toContain('voor 8 personen');
    expect(html).toContain('10 min / 100 °C / snelheid 1');
    expect(html).toContain('Prive notitie');
    expect(html).toContain('Jeroen Meus');
    expect(recipeToHtml(r, { servings: 4, includeNotes: false })).not.toContain('Prive notitie');
  });
});
