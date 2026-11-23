import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';

import { fillTranslations } from '../domain/editing';
import { normalizeQuantity } from '../domain/quantity';
import { newId, noteId } from '../domain/recipe';
import { parseThermomixSettings } from '../domain/thermomix';
import {
  BASE_SERVINGS,
  SCHEMA_VERSION,
  UNITS,
  type Ingredient,
  type Lang,
  type Localized,
  type Note,
  type Recipe,
  type RecipeSource,
} from '../domain/types';

/**
 * Claude turns a recipe (raw page text, or a recipe we already parsed) into
 * the uniform format with every text in both Dutch and English, and assigns
 * canonical ingredient keys for the bilingual ingredient index.
 */

const MODEL = 'claude-opus-5-5';

const Bilingual = z.object({ nl: z.string(), en: z.string() });

const AiRecipe = z.object({
  title: Bilingual,
  description: Bilingual.nullable(),
  originalLanguage: z.enum(['nl', 'en', 'other']),
  servings: z.number().nullable().describe('Number of people the source quantities are for, if stated.'),
  usesThermomix: z.boolean(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  totalMinutes: z.number().nullable(),
  author: z.string().nullable().describe('The cook or author named by the source.'),
  ingredientGroups: z.array(
    z.object({
      title: Bilingual.nullable(),
      items: z.array(
        z.object({
          key: z
            .string()
            .describe('Canonical English kebab-case ingredient id, singular, without preparation, e.g. "onion", "red-onion", "olive-oil".'),
          name: Bilingual.describe('Ingredient name only, without quantity, unit or preparation.'),
          quantity: z.number().nullable().describe('Amount as written for the source servings; lower bound for a range.'),
          quantityMax: z.number().nullable().describe('Upper bound if the source gives a range, else null.'),
          unit: z.enum(UNITS).nullable(),
          unitText: Bilingual.nullable().describe('Only when no listed unit fits.'),
          note: Bilingual.nullable().describe('Preparation or remark, e.g. "finely chopped".'),
          optional: z.boolean(),
          scalable: z.boolean().describe('False for amounts like "to taste" that should not scale with servings.'),
        }),
      ),
    }),
  ),
  stepGroups: z.array(
    z.object({
      title: Bilingual.nullable(),
      steps: z.array(Bilingual),
    }),
  ),
  tips: z.array(Bilingual).describe('Tips, variations, storage advice or other remarks from the source.'),
});
type AiRecipeData = z.infer<typeof AiRecipe>;

const SYSTEM = `You convert cooking recipes into a structured, bilingual (Dutch and English) format for a personal recipe app.

Rules:
- Keep the original recipe faithful; do not invent ingredients, steps or quantities.
- Dutch text uses Flemish/Belgian culinary conventions where natural (e.g. "look", "room", "bloem").
- Translate naturally, as a cookbook would. Keep proper names.
- Step texts that contain Thermomix settings must keep them in the standard notation of that language, e.g. Dutch "3 min./100°C/snelheid 1", "omgekeerde draairichting", "snelheid lepel"; English "3 min/100°C/speed 1", "reverse", "speed spoon"; "Varoma" stays "Varoma".
- Quantities are numbers exactly as the source states them for its own number of servings; do not rescale.
- Split each step into a separate entry; do not number them.
- Ignore page navigation, ads, comments and unrelated content.`;

export class AiImportError extends Error {}

function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

async function structure(apiKey: string, input: string): Promise<AiRecipeData> {
  let response;
  try {
    response = await client(apiKey).beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(AiRecipe) },
      system: SYSTEM,
      messages: [{ role: 'user', content: input }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiImportError('Invalid Claude API key.');
    if (e instanceof Anthropic.RateLimitError) throw new AiImportError('Claude API rate limit reached; try again shortly.');
    if (e instanceof Anthropic.APIError) throw new AiImportError(`Claude API error ${e.status ?? ''}: ${e.message}`);
    throw e;
  }
  if (response.stop_reason === 'refusal') throw new AiImportError('The recipe could not be processed.');
  if (response.stop_reason === 'max_tokens') throw new AiImportError('The recipe is too long to process.');
  if (!response.parsed_output) throw new AiImportError('Could not read a recipe from this page.');
  return response.parsed_output;
}

function loc(b: { nl: string; en: string } | null | undefined): Localized | undefined {
  if (!b) return undefined;
  const out: Localized = {};
  if (b.nl.trim()) out.nl = b.nl.trim();
  if (b.en.trim()) out.en = b.en.trim();
  return Object.keys(out).length ? out : undefined;
}

function toRecipe(ai: AiRecipeData, base: { source?: RecipeSource; imageUrl?: string; thermomix?: boolean; id?: string; createdAt?: string; notes?: Note[] }): Recipe {
  const now = new Date().toISOString();
  const from = ai.servings && ai.servings > 0 ? ai.servings : BASE_SERVINGS;
  const originalLanguage: Lang = ai.originalLanguage === 'en' ? 'en' : 'nl';

  const ingredientGroups = ai.ingredientGroups.map((g) => ({
    title: loc(g.title),
    items: g.items.map((i): Ingredient => {
      const q =
        i.quantity === null ? undefined : i.quantityMax !== null && i.quantityMax !== i.quantity ? { min: i.quantity, max: i.quantityMax } : i.quantity;
      const scalable = i.scalable;
      return {
        key: i.key || undefined,
        name: loc(i.name) ?? {},
        quantity: q === undefined ? undefined : scalable ? normalizeQuantity(q, from, BASE_SERVINGS) : q,
        unit: i.unit ?? undefined,
        unitText: loc(i.unitText),
        note: loc(i.note),
        optional: i.optional || undefined,
        scalable: scalable ? undefined : false,
      };
    }),
  }));

  const stepGroups = ai.stepGroups.map((g) => ({
    title: loc(g.title),
    steps: g.steps.map((s) => {
      const text = loc(s) ?? {};
      const tm = parseThermomixSettings(text[originalLanguage] ?? text.nl ?? text.en ?? '');
      return tm.length ? { text, thermomix: tm } : { text };
    }),
  }));

  const userNotes = (base.notes ?? []).filter((n) => n.origin === 'user');
  const tips: Note[] = ai.tips.map((tip) => ({ id: noteId(), kind: 'tip', text: loc(tip), origin: 'source' }));

  return {
    schemaVersion: SCHEMA_VERSION,
    id: base.id ?? newId(ai.title.en || ai.title.nl),
    title: loc(ai.title) ?? {},
    description: loc(ai.description),
    originalLanguage,
    servings: BASE_SERVINGS,
    originalServings: ai.servings ?? undefined,
    thermomix: !!base.thermomix || ai.usesThermomix || stepGroups.some((g) => g.steps.some((s) => s.thermomix)),
    times: {
      prepMinutes: ai.prepMinutes ?? undefined,
      cookMinutes: ai.cookMinutes ?? undefined,
      totalMinutes: ai.totalMinutes ?? undefined,
    },
    imageUrl: base.imageUrl,
    ingredientGroups,
    stepGroups,
    notes: [...tips, ...userNotes],
    source: base.source ? { ...base.source, author: base.source.author ?? ai.author ?? undefined } : undefined,
    createdAt: base.createdAt ?? now,
    updatedAt: now,
  };
}

/** Extract a recipe from raw page text (no structured data available). */
export async function aiRecipeFromText(
  apiKey: string,
  text: string,
  base: { source?: RecipeSource; imageUrl?: string; thermomix?: boolean },
): Promise<Recipe> {
  const ai = await structure(
    apiKey,
    `Extract the recipe from this web page text${base.source ? ` (${base.source.url})` : ''}:\n\n<page>\n${text}\n</page>`,
  );
  return toRecipe(ai, base);
}

/**
 * Translate and normalize an existing recipe (e.g. parsed from JSON-LD, or
 * already stored) so every field exists in both languages. Quantities in the
 * input are for BASE_SERVINGS. User notes are kept untouched.
 */
export async function aiCompleteRecipe(apiKey: string, recipe: Recipe): Promise<Recipe> {
  const { notes, ...rest } = recipe;
  const sourceTips = notes.filter((n) => n.origin === 'source').map((n) => n.text);
  const ai = await structure(
    apiKey,
    `This recipe is for ${BASE_SERVINGS} servings. Complete it so every text exists in both Dutch and English, and assign ingredient keys.\n\n<recipe>\n${JSON.stringify({ ...rest, tips: sourceTips })}\n</recipe>`,
  );
  const translated = toRecipe({ ...ai, servings: BASE_SERVINGS }, { ...recipe, notes });
  // Keep everything that already exists; only fill in missing languages.
  return { ...fillTranslations(recipe, translated), updatedAt: new Date().toISOString() };
}

export async function aiTranslateText(apiKey: string, text: string, from: Lang): Promise<Localized> {
  const to: Lang = from === 'nl' ? 'en' : 'nl';
  const response = await client(apiKey).messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low' },
    system: `Translate the user's cooking note from ${from === 'nl' ? 'Dutch' : 'English'} to ${to === 'nl' ? 'Dutch (Flemish)' : 'English'}. Reply with the translation only.`,
    messages: [{ role: 'user', content: text }],
  });
  const translated = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
  return { [from]: text, [to]: translated };
}

/**
 * Make a recipe fully bilingual: fills in missing recipe texts and translates
 * the user's own notes that exist in one language only. Existing texts are kept.
 */
export async function aiTranslateRecipe(apiKey: string, recipe: Recipe): Promise<Recipe> {
  const completed = await aiCompleteRecipe(apiKey, recipe);
  const notes = await Promise.all(
    completed.notes.map(async (n) => {
      if (n.origin !== 'user' || !n.text || (n.text.nl && n.text.en)) return n;
      const from: Lang = n.text.nl ? 'nl' : 'en';
      try {
        return { ...n, text: await aiTranslateText(apiKey, n.text[from]!, from) };
      } catch {
        return n;
      }
    }),
  );
  return { ...completed, notes };
}
