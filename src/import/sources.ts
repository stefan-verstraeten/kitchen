import type { Lang } from '../domain/types';

/** Known recipe sites and what we know about them. */
export interface SiteProfile {
  siteName: string;
  /** Default cook when the page does not name one. */
  defaultAuthor?: string;
  language?: Lang;
  thermomix?: boolean;
  /** Shown when import fails (e.g. content behind a login). */
  hint?: { nl: string; en: string };
}

const PROFILES: [RegExp, SiteProfile][] = [
  [
    /(^|\.)cookidoo\.[a-z.]+$/i,
    {
      siteName: 'Cookidoo',
      thermomix: true,
      hint: {
        nl: 'Cookidoo toont sommige recepten pas volledig na aanmelding. Gebruik in dat geval “Tekst plakken” met de recepttekst uit de Cookidoo-app.',
        en: 'Cookidoo only shows some recipes in full after signing in. If so, use “Paste text” with the recipe copied from the Cookidoo app.',
      },
    },
  ],
  [/(^|\.)dagelijksekost\.(vrt\.)?be$/i, { siteName: 'Dagelijkse Kost', defaultAuthor: 'Jeroen Meus', language: 'nl' }],
  [/(^|\.)ah\.(nl|be)$/i, { siteName: 'Allerhande', language: 'nl' }],
  [/(^|\.)leukerecepten\.nl$/i, { siteName: 'Leuke Recepten', language: 'nl' }],
  [/(^|\.)24kitchen\.(nl|be)$/i, { siteName: '24Kitchen', language: 'nl' }],
  [/(^|\.)libelle-lekker\.be$/i, { siteName: 'Libelle Lekker', language: 'nl' }],
  [/(^|\.)bbcgoodfood\.com$/i, { siteName: 'BBC Good Food', language: 'en' }],
  [/(^|\.)ottolenghi\.co\.uk$/i, { siteName: 'Ottolenghi', defaultAuthor: 'Yotam Ottolenghi', language: 'en' }],
];

export function siteProfile(url: string): SiteProfile {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return { siteName: '' };
  }
  for (const [re, profile] of PROFILES) if (re.test(host)) return profile;
  return { siteName: host.replace(/^www\./, '') };
}

export function guessLanguage(text: string, fallback: Lang = 'nl'): Lang {
  const nl = (text.match(/\b(de|het|een|en|van|met|voor|snipper|bak|giet|roer|minuten|ui|zout)\b/gi) ?? []).length;
  const en = (text.match(/\b(the|and|with|for|of|chop|bake|pour|stir|minutes|onion|salt)\b/gi) ?? []).length;
  if (nl === en) return fallback;
  return nl > en ? 'nl' : 'en';
}
