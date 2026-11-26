import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';

import { ingredientKeyFor } from '../domain/ingredientCatalog';
import { normalizeQuantity } from '../domain/quantity';
import { newId, noteId } from '../domain/recipe';
import { clean } from '../domain/text';
import { parseThermomixSettings } from '../domain/thermomix';
import { BASE_SERVINGS, SCHEMA_VERSION, UNITS, type Ingredient, type Note, type Recipe, type RecipeSource } from '../domain/types';

/**
 * Claude reads a recipe from page text without structured recipe data, or from
 * text the user pasted, and returns it in the uniform format. Texts are kept
 * in the language of the source; nothing is translated.
 */

const MODEL = 'claude-opus-5-5';

const AiRecipe = z.object({
  title: z.string(),
  description: z.string().nullable(),
  servings: z.number().nullable().describe('Number of people the source quantities are for, if stated.'),
  usesThermomix: z.boolean(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  totalMinutes: z.number().nullable(),
  author: z.string().nullable().describe('The cook or author named by the source.'),
  ingredientGroups: z.array(
    z.object({
      title: z.string().nullable(),
      items: z.array(
        z.object({
          name: z.string().describe('Ingredient name only, without quantity, unit or preparation.'),
          quantity: z.number().nullable().describe('Amount as written for the source servings; lower bound for a range.'),
          quantityMax: z.number().nullable().describe('Upper bound if the source gives a range, else null.'),
          unit: z.enum(UNITS).nullable(),
          unitText: z.string().nullable().describe('Only when none of the listed units fits.'),
          note: z.string().nullable().describe('Preparation or remark, e.g. "fijngesnipperd".'),
          optional: z.boolean(),
          scalable: z.boolean().describe('False for amounts like "naar smaak" that should not scale with servings.'),
        }),
      ),
    }),
  ),
  stepGroups: z.array(z.object({ title: z.string().nullable(), steps: z.array(z.string()) })),
  tips: z.array(z.string()).describe('Tips, variations, storage advice or other remarks from the source.'),
});
type AiRecipeData = z.infer<typeof AiRecipe>;

const SYSTEM = `You convert cooking recipes into a structured format for a personal recipe app.

Rules:
- Keep the recipe faithful and in the language of the source text. Do not translate, and do not invent ingredients, steps or quantities.
- Keep Thermomix settings in step texts exactly as written (e.g. "3 min./100°C/snelheid 1", "omgekeerde draairichting", "snelheid lepel", "Varoma").
- Quantities are numbers exactly as the source states them for its own number of servings; do not rescale.
- Units: "el" = tbsp, "tl"/"kl" = tsp, "teentje" = clove, "snufje" = pinch, "blik" = can, "stuk" = piece.
- Split each step into a separate entry; do not number them.
- Ignore page navigation, ads, comments and unrelated content.`;

export class AiImportError extends Error {}

async function extract(apiKey: string, input: string): Promise<AiRecipeData> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(AiRecipe) },
      system: SYSTEM,
      messages: [{ role: 'user', content: input }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiImportError('Ongeldige Claude API-sleutel.');
    if (e instanceof Anthropic.RateLimitError) throw new AiImportError('Te veel aanvragen bij Claude; probeer het straks opnieuw.');
    if (e instanceof Anthropic.APIError) throw new AiImportError(`Fout bij Claude (${e.status ?? '?'}): ${e.message}`);
    throw e;
  }
  if (response.stop_reason === 'refusal') throw new AiImportError('Het recept kon niet verwerkt worden.');
  if (response.stop_reason === 'max_tokens') throw new AiImportError('Het recept is te lang om te verwerken.');
  if (!response.parsed_output) throw new AiImportError('Er werd geen recept gevonden in deze tekst.');
  return response.parsed_output;
}

function toRecipe(ai: AiRecipeData, base: { source?: RecipeSource; imageUrl?: string; thermomix?: boolean }): Recipe {
  const now = new Date().toISOString();
  const from = ai.servings && ai.servings > 0 ? ai.servings : BASE_SERVINGS;

  const ingredientGroups = ai.ingredientGroups.map((g) => ({
    title: clean(g.title),
    items: g.items.map((i): Ingredient => {
      const q =
        i.quantity === null ? undefined : i.quantityMax !== null && i.quantityMax !== i.quantity ? { min: i.quantity, max: i.quantityMax } : i.quantity;
      return {
        key: ingredientKeyFor(i.name),
        name: i.name.trim(),
        quantity: q === undefined ? undefined : i.scalable ? normalizeQuantity(q, from, BASE_SERVINGS) : q,
        unit: i.unit ?? undefined,
        unitText: clean(i.unitText),
        note: clean(i.note),
        optional: i.optional || undefined,
        scalable: i.scalable ? undefined : false,
      };
    }),
  }));

  const stepGroups = ai.stepGroups.map((g) => ({
    title: clean(g.title),
    steps: g.steps
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => {
        const tm = parseThermomixSettings(text);
        return tm.length ? { text, thermomix: tm } : { text };
      }),
  }));

  const notes: Note[] = ai.tips.filter((tip) => tip.trim()).map((tip) => ({ id: noteId(), kind: 'tip', text: tip.trim(), origin: 'source' }));

  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(ai.title),
    title: ai.title.trim(),
    description: clean(ai.description),
    servings: BASE_SERVINGS,
    originalServings: ai.servings ?? undefined,
    thermomix: !!base.thermomix || ai.usesThermomix || stepGroups.some((g) => g.steps.some((st) => 'thermomix' in st)),
    times: {
      prepMinutes: ai.prepMinutes ?? undefined,
      cookMinutes: ai.cookMinutes ?? undefined,
      totalMinutes: ai.totalMinutes ?? undefined,
    },
    imageUrl: base.imageUrl,
    ingredientGroups,
    stepGroups,
    notes,
    source: base.source ? { ...base.source, author: base.source.author ?? clean(ai.author) } : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/** Extract a recipe from page text or pasted text. */
export async function aiRecipeFromText(
  apiKey: string,
  text: string,
  base: { source?: RecipeSource; imageUrl?: string; thermomix?: boolean },
): Promise<Recipe> {
  const ai = await extract(apiKey, `Extract the recipe from this text${base.source?.url ? ` (${base.source.url})` : ''}:\n\n<text>\n${text}\n</text>`);
  return toRecipe(ai, base);
}

/**
 * Fetch a web page's text through Claude's web fetch tool. Used by the web
 * app, where the browser may not download other sites' pages itself (CORS).
 */
export async function aiFetchPageText(apiKey: string, url: string): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new AiImportError('Ongeldige link.');
  }
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Fetch ${url} with the web_fetch tool. When it has been fetched, reply only with "OK".` },
  ];
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        output_config: { effort: 'low' },
        tools: [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 2, allowed_domains: [host], max_content_tokens: 40000 }],
        messages,
      });
      for (const block of response.content) {
        if (block.type !== 'web_fetch_tool_result') continue;
        if (block.content.type === 'web_fetch_tool_result_error') {
          throw new AiImportError(`De pagina kon niet opgehaald worden (${block.content.error_code}).`);
        }
        const source = block.content.content.source;
        if (source.type === 'text' && source.data.trim()) return source.data;
      }
      if (response.stop_reason !== 'pause_turn') break;
      // Server-side tool loop paused: send the turn back to let it continue.
      messages.push({ role: 'assistant', content: response.content });
    }
  } catch (e) {
    if (e instanceof AiImportError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiImportError('Ongeldige Claude API-sleutel.');
    if (e instanceof Anthropic.APIError) throw new AiImportError(`Fout bij Claude (${e.status ?? '?'}): ${e.message}`);
    throw e;
  }
  throw new AiImportError('De pagina kon niet opgehaald worden.');
}
