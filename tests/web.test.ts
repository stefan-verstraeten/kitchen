import { describe, expect, it } from 'vitest';

import { emptyRecipe } from '../src/domain/recipe';
import { recipeToPdfDefinition } from '../src/export/recipePdf';
import { importFromUrl, ImportError } from '../src/import/importRecipe';

describe('import from a link when the page cannot be downloaded (web app / CORS)', () => {
  it('asks for a Claude key instead of failing silently', async () => {
    const failingFetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    await expect(importFromUrl('https://dagelijksekost.vrt.be/gerechten/x', { fetchImpl: failingFetch })).rejects.toBeInstanceOf(ImportError);
  });
});

describe('web PDF document', () => {
  it('contains the recipe, scaled ingredients and Thermomix settings', () => {
    const r = emptyRecipe('Soep');
    r.ingredientGroups = [{ items: [{ name: 'bloem', quantity: 200, unit: 'g' }] }];
    r.stepGroups = [{ steps: [{ text: 'Mixen.', thermomix: [{ timeSeconds: 10, speed: 5 }] }] }];
    r.notes = [{ id: 'n', kind: 'note', text: 'Prive', origin: 'user' }];
    const json = JSON.stringify(recipeToPdfDefinition(r, { servings: 6 }));
    expect(json).toContain('Soep');
    expect(json).toContain('300 g');
    expect(json).toContain('voor 6 personen');
    expect(json).toContain('10 sec / snelheid 5');
    expect(json).toContain('Prive');
    expect(JSON.stringify(recipeToPdfDefinition(r, { servings: 4, includeNotes: false }))).not.toContain('Prive');
  });
});
