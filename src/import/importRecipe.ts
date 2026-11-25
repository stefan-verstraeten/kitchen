import type { Recipe } from '../domain/types';
import { aiRecipeFromText } from './ai';
import { findRecipeJsonLd, mainText, metaContent } from './html';
import { recipeFromJsonLd } from './jsonld';
import { siteProfile } from './sources';

export class ImportError extends Error {
  constructor(
    message: string,
    /** Extra advice for this site, e.g. that Cookidoo needs a login. */
    readonly hint?: string,
  ) {
    super(message);
  }
}

export interface ImportOptions {
  /** Claude API key; enables reading pages without structured recipe data. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.5',
};

/** Parse an already-downloaded page. Exposed separately for testing. */
export async function importFromHtml(url: string, html: string, opts: ImportOptions = {}): Promise<Recipe> {
  const profile = siteProfile(url);
  const ld = findRecipeJsonLd(html);

  if (ld) {
    const recipe = recipeFromJsonLd(ld, url, profile);
    const hasContent = recipe.ingredientGroups[0].items.length > 0 || recipe.stepGroups.length > 0;
    if (hasContent) return recipe;
    if (!opts.apiKey) throw new ImportError('Op deze pagina staat geen leesbaar recept.', profile.hint);
  }

  if (!opts.apiKey) {
    throw new ImportError(
      'Deze pagina bevat geen receptgegevens. Voeg een Claude API-sleutel toe (Instellingen) om ze toch te lezen.',
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
    throw new ImportError('De pagina is niet bereikbaar. Controleer de link en je verbinding.');
  }
  if (!res.ok) throw new ImportError(`De pagina gaf een fout (${res.status}).`, siteProfile(url).hint);
  return importFromHtml(res.url || url, await res.text(), opts);
}

/** Import from text pasted by the user (e.g. from the Cookidoo app). Requires an API key. */
export async function importFromText(text: string, opts: ImportOptions & { url?: string; author?: string }): Promise<Recipe> {
  if (!opts.apiKey) throw new ImportError('Om geplakte tekst te verwerken is een Claude API-sleutel nodig (Instellingen).');
  const profile = opts.url ? siteProfile(opts.url) : undefined;
  return aiRecipeFromText(opts.apiKey, text, {
    thermomix: profile?.thermomix,
    source:
      opts.url || opts.author
        ? {
            url: opts.url ?? '',
            siteName: profile?.siteName || undefined,
            author: opts.author ?? profile?.defaultAuthor,
            importedAt: new Date().toISOString(),
          }
        : undefined,
  });
}
