/** Known recipe sites and what we know about them. */
export interface SiteProfile {
  siteName: string;
  /** Default cook when the page does not name one. */
  defaultAuthor?: string;
  thermomix?: boolean;
  /** Shown when import fails (e.g. content behind a login). */
  hint?: string;
}

const PROFILES: [RegExp, SiteProfile][] = [
  [
    /(^|\.)cookidoo\.[a-z.]+$/i,
    {
      siteName: 'Cookidoo',
      thermomix: true,
      hint: 'Cookidoo toont sommige recepten pas volledig na aanmelding. Gebruik in dat geval “Tekst plakken” met de recepttekst uit de Cookidoo-app.',
    },
  ],
  [/(^|\.)dagelijksekost\.(vrt\.)?be$/i, { siteName: 'Dagelijkse Kost', defaultAuthor: 'Jeroen Meus' }],
  [/(^|\.)ah\.(nl|be)$/i, { siteName: 'Allerhande' }],
  [/(^|\.)leukerecepten\.nl$/i, { siteName: 'Leuke Recepten' }],
  [/(^|\.)24kitchen\.(nl|be)$/i, { siteName: '24Kitchen' }],
  [/(^|\.)libelle-lekker\.be$/i, { siteName: 'Libelle Lekker' }],
  [/(^|\.)bbcgoodfood\.com$/i, { siteName: 'BBC Good Food' }],
  [/(^|\.)ottolenghi\.co\.uk$/i, { siteName: 'Ottolenghi', defaultAuthor: 'Yotam Ottolenghi' }],
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
