import { describe, expect, it } from 'vitest';

import { ingredientKeyFor } from '../src/domain/ingredientCatalog';
import { buildIngredientIndex, searchIngredientIndex } from '../src/domain/ingredientIndex';
import { parseIngredientLine } from '../src/domain/ingredientLine';
import { formatQuantity, parseQuantity, parseServings, quantityFor } from '../src/domain/quantity';
import { addCookedDate, emptyRecipe, mergeRecipes } from '../src/domain/recipe';
import { formatThermomixSetting, parseThermomixSettings } from '../src/domain/thermomix';

describe('quantities', () => {
  it('parses numbers, fractions and ranges', () => {
    expect(parseQuantity('1,5')).toBe(1.5);
    expect(parseQuantity('1 1/2')).toBe(1.5);
    expect(parseQuantity('½')).toBe(0.5);
    expect(parseQuantity('2-3')).toEqual({ min: 2, max: 3 });
    expect(parseQuantity('2 à 3')).toEqual({ min: 2, max: 3 });
  });

  it('formats for the kitchen', () => {
    expect(formatQuantity(0.5, 'tbsp', 'nl')).toBe('½');
    expect(formatQuantity(1.33, 'piece', 'en')).toBe('1⅓');
    expect(formatQuantity(333.3, 'g', 'nl')).toBe('335');
    expect(formatQuantity(1.25, 'l', 'nl')).toBe('1,3');
    expect(formatQuantity({ min: 1, max: 1.5 }, undefined, 'en')).toBe('1–1½');
  });

  it('scales from the base of 4', () => {
    expect(quantityFor({ name: {}, quantity: 200, unit: 'g' }, 6, 4)).toBe(300);
    expect(quantityFor({ name: {}, quantity: 1, unit: 'pinch', scalable: false }, 8, 4)).toBe(1);
  });

  it('reads servings', () => {
    expect(parseServings('6 personen')).toBe(6);
    expect(parseServings(['4', '4 porties'])).toBe(4);
    expect(parseServings('Serves 2-3')).toBe(2);
  });
});

describe('ingredient lines', () => {
  it('parses Dutch lines', () => {
    const a = parseIngredientLine('200 g bloem', 'nl');
    expect(a).toMatchObject({ quantity: 200, unit: 'g', name: { nl: 'bloem' }, key: 'flour' });
    const b = parseIngredientLine('2 uien, fijngesnipperd', 'nl');
    expect(b).toMatchObject({ quantity: 2, name: { nl: 'uien' }, note: { nl: 'fijngesnipperd' }, key: 'onion' });
    const c = parseIngredientLine('1-2 teentjes look (optioneel)', 'nl');
    expect(c).toMatchObject({ quantity: { min: 1, max: 2 }, unit: 'clove', name: { nl: 'look' }, optional: true, key: 'garlic' });
    const d = parseIngredientLine('zout en peper', 'nl');
    expect(d).toMatchObject({ scalable: false, key: 'salt-and-pepper' });
    expect(parseIngredientLine('3 el olijfolie', 'nl')).toMatchObject({ unit: 'tbsp', key: 'olive-oil' });
  });

  it('parses English lines', () => {
    expect(parseIngredientLine('2 tbsp olive oil, divided', 'en')).toMatchObject({
      quantity: 2,
      unit: 'tbsp',
      name: { en: 'olive oil' },
      note: { en: 'divided' },
      key: 'olive-oil',
    });
    expect(parseIngredientLine('1 small red onion', 'en').key).toBe('red-onion');
  });

  it('maps names in both languages to one key', () => {
    expect(ingredientKeyFor('ajuin')).toBe('onion');
    expect(ingredientKeyFor('Onions')).toBe('onion');
    expect(ingredientKeyFor('kleine rode ui')).toBe('red-onion');
    expect(ingredientKeyFor('verse gember')).toBe('ginger');
    expect(ingredientKeyFor('zwarte peper')).toBe('pepper');
    expect(ingredientKeyFor('dragonfruit sorbet')).toBeUndefined();
  });
});

describe('thermomix', () => {
  it('parses Dutch Cookidoo notation', () => {
    const [s] = parseThermomixSettings('Ui toevoegen en 5 sec./snelheid 5 fijnhakken.');
    expect(s).toMatchObject({ timeSeconds: 5, speed: 5 });
    const [t] = parseThermomixSettings('12 min./100°C/omgekeerde draairichting/snelheid lepel koken.');
    expect(t).toMatchObject({ timeSeconds: 720, temperature: 100, reverse: true, speed: 'spoon' });
  });

  it('parses English, German, Varoma and modes', () => {
    expect(parseThermomixSettings('Cook 20 min/Varoma/speed 1')[0]).toMatchObject({ timeSeconds: 1200, temperature: 'varoma', speed: 1 });
    expect(parseThermomixSettings('10 Min./100°C/Linkslauf/Stufe 1')[0]).toMatchObject({ reverse: true, speed: 1, temperature: 100 });
    expect(parseThermomixSettings('Knead 2 min/dough mode')[0]).toMatchObject({ timeSeconds: 120, mode: 'knead' });
    expect(parseThermomixSettings('10 sec/speed 5-10')[0]).toMatchObject({ speed: 10 });
  });

  it('ignores ordinary text', () => {
    expect(parseThermomixSettings('Bak 10 minuten in de oven op 180°C.')).toEqual([]);
    expect(parseThermomixSettings('Voeg 10 stuks toe.')).toEqual([]);
  });

  it('formats uniformly in both languages', () => {
    const s = { timeSeconds: 180, temperature: 100, reverse: true, speed: 'spoon' as const };
    expect(formatThermomixSetting(s, 'nl')).toBe('3 min / 100 °C / omgekeerde draairichting / snelheid lepel');
    expect(formatThermomixSetting(s, 'en')).toBe('3 min / 100 °C / reverse / speed spoon');
  });
});

describe('ingredient index', () => {
  it('groups recipes and searches in both languages', () => {
    const a = emptyRecipe('nl', 'Stoofvlees');
    a.ingredientGroups[0].items.push(parseIngredientLine('2 ajuinen', 'nl'), parseIngredientLine('1 kg stoofvlees', 'nl'));
    const b = emptyRecipe('en', 'Onion soup');
    b.ingredientGroups[0].items.push(parseIngredientLine('6 onions', 'en'), parseIngredientLine('1 tbsp mystery spice', 'en'));
    const index = buildIngredientIndex([a, b]);
    const onion = index.find((e) => e.key === 'onion')!;
    expect(onion.recipeIds).toEqual([a.id, b.id]);
    expect(searchIngredientIndex(index, 'ui', 'nl')[0].key).toBe('onion');
    expect(searchIngredientIndex(index, 'onion', 'nl')[0].key).toBe('onion');
    expect(searchIngredientIndex(index, 'mystery', 'en')[0].name.en).toBe('mystery spice');
  });
});

describe('notes and merging', () => {
  it('keeps cooked dates from both conflicting versions', () => {
    const base = emptyRecipe('nl', 'Soep');
    const left = addCookedDate(base, '2026-11-01');
    const right = { ...addCookedDate(base, '2026-11-20'), updatedAt: '2099-01-01T00:00:00Z' };
    const merged = mergeRecipes(left, right);
    expect(merged.notes.map((n) => n.date).sort()).toEqual(['2026-11-01', '2026-11-20']);
  });
});

describe('ingredient search precision', () => {
  it('does not match short queries inside other words', () => {
    const r = emptyRecipe('nl', 'x');
    r.ingredientGroups[0].items.push(parseIngredientLine('1 ui', 'nl'), parseIngredientLine('33 cl bruin bier', 'nl'), parseIngredientLine('1 l bouillon', 'nl'), parseIngredientLine('500 g rundergehakt', 'nl'));
    const index = buildIngredientIndex([r]);
    expect(searchIngredientIndex(index, 'ui', 'nl').map((e) => e.key)).toEqual(['onion']);
    expect(searchIngredientIndex(index, 'gehakt', 'nl').length).toBe(1);
  });
});
