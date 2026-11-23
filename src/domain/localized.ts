import { LANGUAGES, type Lang, type Localized } from './types';

export interface ResolvedText {
  text: string;
  /** Language the text is actually in; differs from the requested one when falling back. */
  lang: Lang;
  isFallback: boolean;
}

/** Pick the text for `lang`, falling back to the other language. */
export function resolve(value: Localized | undefined, lang: Lang): ResolvedText | undefined {
  if (!value) return undefined;
  const direct = value[lang]?.trim();
  if (direct) return { text: direct, lang, isFallback: false };
  for (const other of LANGUAGES) {
    const t = value[other]?.trim();
    if (t) return { text: t, lang: other, isFallback: true };
  }
  return undefined;
}

export function t(value: Localized | undefined, lang: Lang): string {
  return resolve(value, lang)?.text ?? '';
}

export function localized(lang: Lang, text: string | undefined): Localized | undefined {
  const trimmed = text?.trim();
  return trimmed ? { [lang]: trimmed } : undefined;
}

/** Lowercase, strip accents and punctuation — for search and key matching. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slugify(s: string): string {
  return fold(s).replace(/ /g, '-').slice(0, 60);
}
