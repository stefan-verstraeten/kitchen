import { describe, expect, it } from 'vitest';

import { extractJsonLd } from '../src/import/html';
import { importFromHtml, ImportError } from '../src/import/importRecipe';
import { instructionGroups, isoDurationToMinutes } from '../src/import/jsonld';

const page = (ld: object, lang = 'nl-BE') =>
  `<html lang="${lang}"><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><main>x</main></body></html>`;

describe('JSON-LD import', () => {
  it('handles @graph, sections and durations', () => {
    const html = page({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, { '@type': ['Recipe'], name: 'X' }] });
    expect(extractJsonLd(html).some((o) => o.name === 'X')).toBe(true);
    expect(isoDurationToMinutes('PT1H30M')).toBe(90);
    const groups = instructionGroups([
      { '@type': 'HowToSection', name: 'Saus', itemListElement: [{ '@type': 'HowToStep', text: 'Roer.' }] },
      { '@type': 'HowToStep', text: '1. Serveer.' },
    ]);
    expect(groups).toEqual([{ title: 'Saus', steps: ['Roer.', 'Serveer.'] }]);
  });

  it('normalizes a Dagelijkse Kost style recipe to 4 people', async () => {
    const html = page({
      '@type': 'Recipe',
      name: 'Stoofvlees met frietjes',
      recipeYield: '6 personen',
      recipeIngredient: ['1,5 kg runderstoofvlees', '3 ajuinen', '2 sneetjes bruin brood', 'mosterd', 'zout en peper'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Snij de ajuinen.' }, { '@type': 'HowToStep', text: 'Laat 2 uur stoven.' }],
      tip: 'Nog lekkerder de dag nadien.',
    });
    const r = await importFromHtml('https://dagelijksekost.vrt.be/gerechten/stoofvlees-met-frietjes', html);
    expect(r.servings).toBe(4);
    expect(r.originalServings).toBe(6);
    expect(r.ingredientGroups[0].items[0]).toMatchObject({ quantity: 1, unit: 'kg', key: 'beef' });
    expect(r.ingredientGroups[0].items[1]).toMatchObject({ quantity: 2, key: 'onion' });
    expect(r.source).toMatchObject({ siteName: 'Dagelijkse Kost', author: 'Jeroen Meus' });
    expect(r.thermomix).toBe(false);
    expect(r.notes[0]).toMatchObject({ kind: 'tip', origin: 'source', text: { nl: 'Nog lekkerder de dag nadien.' } });
  });

  it('flags Cookidoo recipes as Thermomix and extracts settings', async () => {
    const html = page(
      {
        '@type': 'Recipe',
        name: 'Tomato soup',
        recipeYield: '4 portions',
        author: { '@type': 'Organization', name: 'Vorwerk Thermomix' },
        recipeIngredient: ['1 onion, halved', '800 g canned tomatoes'],
        recipeInstructions: [
          { '@type': 'HowToStep', text: 'Place onion in mixing bowl and chop 5 sec/speed 5.' },
          { '@type': 'HowToStep', text: 'Add tomatoes and cook 20 min/100°C/speed 1.' },
        ],
      },
      'en',
    );
    const r = await importFromHtml('https://cookidoo.international/recipes/recipe/en/r123', html);
    expect(r.thermomix).toBe(true);
    expect(r.originalLanguage).toBe('en');
    expect(r.stepGroups[0].steps[1].thermomix).toEqual([{ raw: '20 min/100°C/speed 1', timeSeconds: 1200, temperature: 100, speed: 1 }]);
    expect(r.source).toMatchObject({ siteName: 'Cookidoo', author: 'Vorwerk Thermomix' });
  });

  it('asks for an API key when there is no structured data', async () => {
    await expect(importFromHtml('https://example.com/r', '<html><body>Soep</body></html>')).rejects.toBeInstanceOf(ImportError);
  });
});
