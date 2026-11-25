/**
 * Uniform recipe format. One JSON file per recipe is stored in Dropbox
 * (see src/storage). Recipes are kept in a single language (normally Dutch),
 * exactly as imported or typed.
 */

/** All recipes are stored normalized to this many servings. */
export const BASE_SERVINGS = 4;

/** 2 = single-language texts (version 1 stored Dutch/English pairs). */
export const SCHEMA_VERSION = 2;

/**
 * Canonical units. Display names live in src/i18n/units.ts.
 * Anything not covered is kept as free text in `Ingredient.unitText`.
 */
export const UNITS = [
  'g',
  'kg',
  'mg',
  'ml',
  'cl',
  'dl',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'clove',
  'pinch',
  'bunch',
  'sprig',
  'slice',
  'can',
  'jar',
  'pack',
  'handful',
  'leaf',
  'stalk',
  'dash',
] as const;
export type Unit = (typeof UNITS)[number];

/** A single number or a range such as "2-3". Always expressed for BASE_SERVINGS. */
export type Quantity = number | { min: number; max: number };

export interface Ingredient {
  /** Catalog key that groups spellings in the ingredient index, e.g. "onion" for ui/ajuin/uien. */
  key?: string;
  name: string;
  quantity?: Quantity;
  unit?: Unit;
  /** Free-text unit when no canonical unit fits (e.g. "bolletje"). */
  unitText?: string;
  /** Preparation hint, e.g. "fijngesnipperd". */
  note?: string;
  optional?: boolean;
  /** False for amounts that should not scale with servings ("salt to taste"). */
  scalable?: boolean;
  /** Original line from the source, kept for traceability. */
  raw?: string;
}

export interface IngredientGroup {
  title?: string;
  items: Ingredient[];
}

/** Thermomix speeds: 0.5-10, plus the special "spoon" (stirring) speed. */
export type ThermomixSpeed = number | 'spoon';

export type ThermomixMode =
  | 'knead'
  | 'turbo'
  | 'browning'
  | 'steam'
  | 'slow-cook'
  | 'sous-vide'
  | 'fermentation'
  | 'warm-up'
  | 'rice-cooker'
  | 'blend'
  | 'egg-boiler'
  | 'pre-clean';

/** Machine settings for one step on the Vorwerk Thermomix. */
export interface ThermomixSetting {
  /** Duration in seconds. */
  timeSeconds?: number;
  /** Temperature in °C, or the Varoma setting. */
  temperature?: number | 'varoma';
  speed?: ThermomixSpeed;
  /** Counter-clockwise operation ("Linkslauf" / "omgekeerde draairichting"). */
  reverse?: boolean;
  mode?: ThermomixMode;
  /** Original notation as it appeared in the source, e.g. "3 Min./100°C/Stufe 1". */
  raw?: string;
}

export interface Step {
  text: string;
  /** One or more machine settings mentioned in this step. */
  thermomix?: ThermomixSetting[];
}

export interface StepGroup {
  title?: string;
  steps: Step[];
}

export type NoteKind = 'cooked' | 'note' | 'tip';

export interface Note {
  id: string;
  kind: NoteKind;
  /** ISO date (YYYY-MM-DD). Required for 'cooked', optional otherwise. */
  date?: string;
  text?: string;
  /** 'source' = retained from the original recipe page, 'user' = written in the app. */
  origin: 'user' | 'source';
}

export interface RecipeSource {
  url: string;
  /** Site or brand, e.g. "Cookidoo", "Dagelijkse Kost". */
  siteName?: string;
  /** The cook / author, e.g. "Jeroen Meus". */
  author?: string;
  importedAt: string;
}

export interface Recipe {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  description?: string;
  /** Always BASE_SERVINGS; quantities are stored for this many people. */
  servings: typeof BASE_SERVINGS;
  /** Servings as stated by the source, before normalization. */
  originalServings?: number;
  /** True when the recipe is prepared with a Vorwerk Thermomix. */
  thermomix: boolean;
  /** e.g. "TM6" */
  thermomixModel?: string;
  times?: { prepMinutes?: number; cookMinutes?: number; totalMinutes?: number };
  imageUrl?: string;
  tags?: string[];
  ingredientGroups: IngredientGroup[];
  stepGroups: StepGroup[];
  notes: Note[];
  source?: RecipeSource;
  createdAt: string;
  updatedAt: string;
}
