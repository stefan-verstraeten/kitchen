import { parseIngredientLine } from '../domain/ingredientLine';
import { normalizeQuantity, parseServings } from '../domain/quantity';
import { newId, noteId } from '../domain/recipe';
import { parseThermomixSettings } from '../domain/thermomix';
import {
  BASE_SERVINGS,
  SCHEMA_VERSION,
  type IngredientGroup,
  type Note,
  type Recipe,
  type StepGroup,
} from '../domain/types';
import { decodeEntities, htmlToText } from './html';
import type { SiteProfile } from './sources';

type Json = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return htmlToText(decodeEntities(v)) || undefined;
  if (typeof v === 'number') return String(v);
  return undefined;
}

function nameOf(v: unknown): string | undefined {
  if (Array.isArray(v)) return v.map(nameOf).filter(Boolean).join(', ') || undefined;
  if (v && typeof v === 'object') return str((v as Json).name);
  return str(v);
}

function imageOf(v: unknown): string | undefined {
  if (Array.isArray(v)) return imageOf(v[0]);
  if (v && typeof v === 'object') return str((v as Json).url) ?? str((v as Json).contentUrl);
  return str(v);
}

/** ISO 8601 duration ("PT1H30M") to minutes. */
export function isoDurationToMinutes(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?)?$/i.exec(v.trim());
  if (!m) return undefined;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return minutes || undefined;
}

interface RawStepGroup {
  title?: string;
  steps: string[];
}

/** Flatten the many shapes of recipeInstructions into titled groups of step strings. */
export function instructionGroups(v: unknown): RawStepGroup[] {
  const groups: RawStepGroup[] = [{ steps: [] }];
  const push = (text: string | undefined) => {
    if (!text) return;
    for (const line of text.split(/\n+/)) {
      const t = line.replace(/^\s*\d+[.)]\s+/, '').trim();
      if (t) groups[groups.length - 1].steps.push(t);
    }
  };
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === 'string') return push(str(node));
    if (!node || typeof node !== 'object') return;
    const obj = node as Json;
    const type = obj['@type'];
    if (type === 'HowToSection' || Array.isArray(obj.itemListElement)) {
      groups.push({ title: str(obj.name), steps: [] });
      visit(obj.itemListElement);
      return;
    }
    push(str(obj.text) ?? str(obj.name));
  };
  visit(v);
  return groups.filter((g) => g.steps.length > 0);
}

/** Convert a schema.org Recipe object into our uniform format. */
export function recipeFromJsonLd(ld: Json, url: string, profile: SiteProfile): Recipe {
  const now = new Date().toISOString();
  const title = str(ld.name) ?? '';
  const originalServings = parseServings(ld.recipeYield);
  const from = originalServings ?? BASE_SERVINGS;

  const ingredientLines = (Array.isArray(ld.recipeIngredient) ? ld.recipeIngredient : Array.isArray(ld.ingredients) ? ld.ingredients : [])
    .map(str)
    .filter((s): s is string => !!s);

  const ingredientGroups: IngredientGroup[] = [
    {
      items: ingredientLines.map((line) => {
        const ing = parseIngredientLine(line);
        if (ing.quantity !== undefined && ing.scalable !== false) {
          ing.quantity = normalizeQuantity(ing.quantity, from, BASE_SERVINGS);
        }
        return ing;
      }),
    },
  ];

  const rawGroups = instructionGroups(ld.recipeInstructions);
  const stepGroups: StepGroup[] = rawGroups.map((g) => ({
    title: g.title,
    steps: g.steps.map((text) => {
      const tm = parseThermomixSettings(text);
      return tm.length ? { text, thermomix: tm } : { text };
    }),
  }));

  const usesThermomix =
    !!profile.thermomix || stepGroups.some((g) => g.steps.some((s) => (s.thermomix?.length ?? 0) > 0));

  const notes: Note[] = [];
  const tipSources = [ld.tip, ld.tips, ld.recipeNotes, ld.notes].flat().map(str).filter((s): s is string => !!s);
  for (const tip of tipSources) notes.push({ id: noteId(), kind: 'tip', text: tip, origin: 'source' });

  const keywords = typeof ld.keywords === 'string' ? ld.keywords.split(',') : Array.isArray(ld.keywords) ? ld.keywords : [];
  const tags = [ld.recipeCategory, ld.recipeCuisine, keywords]
    .flat()
    .map(str)
    .filter((s): s is string => !!s)
    .slice(0, 12)
    .map((s) => s.trim());

  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(title),
    title,
    description: str(ld.description),
    servings: BASE_SERVINGS,
    originalServings,
    thermomix: usesThermomix,
    times: {
      prepMinutes: isoDurationToMinutes(ld.prepTime),
      cookMinutes: isoDurationToMinutes(ld.cookTime),
      totalMinutes: isoDurationToMinutes(ld.totalTime),
    },
    imageUrl: imageOf(ld.image),
    tags: tags.length ? tags : undefined,
    ingredientGroups,
    stepGroups,
    notes,
    source: {
      url,
      siteName: profile.siteName || nameOf(ld.publisher),
      author: nameOf(ld.author) ?? profile.defaultAuthor,
      importedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}
