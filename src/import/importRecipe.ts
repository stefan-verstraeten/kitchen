import type { Lang, Recipe } from '../domain/types';
import { aiCompleteRecipe, aiRecipeFromText } from './ai';
import { findRecipeJsonLd, htmlLang, mainText, metaContent } from './html';
import { recipeFromJsonLd } from './jsonld';
import { guessLanguage, siteProfile } from './sources';

export class ImportError extends Error {
  constructor(
    message: string,
    readonly hint?: { nl: string; en: string },
  ) {
    super(message);
  }
}

export interface ImportOptions {
  /** Claude API key; enables translation and extraction from pages without structured data. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.8',
};

function langFrom(tag: string | undefined): Lang | undefined {
  if (!tag) return undefined;
  if (/^nl/i.test(tag)) return 'nl';
  if (/^en/i.test(tag)) return 'en';
  return undefined;
}

/** Parse an already-downloaded page. Exposed separately for testing. */
export async function importFromHtml(url: string, html: string, opts: ImportOptions = {}): Promise<Recipe> {
  const profile = siteProfile(url);
  const ld = findRecipeJsonLd(html);
  const pageLang =
    langFrom((ld?.inLanguage as string | undefined) ?? htmlLang(html)) ?? profile.language ?? guessLanguage(mainText(html, 5000));

  if (ld) {
    const recipe = recipeFromJsonLd(ld, url, pageLang, profile);
    if (recipe.ingredientGroups[0].items.length === 0 && recipe.stepGroups.length === 0) {
      if (!opts.apiKey) throw new ImportError('The page has no readable recipe.', profile.hint);
    } else {
      return opts.apiKey ? aiCompleteRecipe(opts.apiKey, recipe) : recipe;
    }
  }

  if (!opts.apiKey) {
    throw new ImportError(
      'This page has no structured recipe data. Add a Claude API key in Settings to import it.',
      profile.hint,
    );
  }
  return aiRecipeFromText(opts.apiKey, mainText(html), {
    thermomix: profile.thermomix,
    imageUrl: metaContent(html, 'og:image'),
    source: {
      url,
      siteName: profile.siteName || metaContent(html, 'og:site_name'),
      author: profile.defaultAuthor,
      importedAt: new Date().toISOString(),
    },
  });
}

export async function importFromUrl(url: string, opts: ImportOptions = {}): Promise<Recipe> {
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url, { headers: BROWSER_HEADERS });
  } catch {
    throw new ImportError('Could not reach the page. Check the link and your connection.');
  }
  if (!res.ok) throw new ImportError(`The page returned an error (${res.status}).`, siteProfile(url).hint);
  return importFromHtml(res.url || url, await res.text(), opts);
}

/** Import from text pasted by the user (e.g. from the Cookidoo app). Requires an API key. */
export async function importFromText(text: string, opts: ImportOptions & { url?: string; author?: string }): Promise<Recipe> {
  if (!opts.apiKey) throw new ImportError('Importing pasted text needs a Claude API key (Settings).');
  const profile = opts.url ? siteProfile(opts.url) : undefined;
  return aiRecipeFromText(opts.apiKey, text, {
    thermomix: profile?.thermomix,
    source: opts.url
      ? { url: opts.url, siteName: profile?.siteName, author: opts.author ?? profile?.defaultAuthor, importedAt: new Date().toISOString() }
      : undefined,
  });
}
