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

/** Trimmed text, or undefined when empty. */
export function clean(s: string | undefined | null): string | undefined {
  const v = s?.trim();
  return v ? v : undefined;
}
