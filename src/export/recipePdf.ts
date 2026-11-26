import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

import { displayIngredient } from '../domain/display';
import { cookedDates } from '../domain/recipe';
import { formatThermomixSetting } from '../domain/thermomix';
import type { Recipe } from '../domain/types';
import { s } from '../ui/strings';
import { formatDate, type PdfOptions } from './recipeHtml';

const ACCENT = '#B5532E';
const MUTED = '#7A6F66';
const TM = '#00865A';

/**
 * pdfmake document for a recipe (used by the web app, where the system print
 * engine is not available). Same content as the HTML used on iOS/Android.
 */
export function recipeToPdfDefinition(recipe: Recipe, { servings, includeNotes = true }: PdfOptions): TDocumentDefinitions {
  const times = recipe.times ?? {};
  const meta = [
    times.prepMinutes ? `${s.prep}: ${s.minutes(times.prepMinutes)}` : '',
    times.cookMinutes ? `${s.cook}: ${s.minutes(times.cookMinutes)}` : '',
    times.totalMinutes ? `${s.total}: ${s.minutes(times.totalMinutes)}` : '',
    recipe.thermomix ? s.thermomix : '',
  ].filter(Boolean);
  const src = recipe.source;
  const byline = [src?.author, src?.siteName].filter(Boolean).join(' · ');

  const ingredients: Content[] = recipe.ingredientGroups.flatMap((g): Content[] => [
    ...(g.title ? [{ text: g.title, style: 'h3' } as Content] : []),
    {
      table: {
        widths: ['auto', '*'],
        body: g.items.map((ing) => {
          const d = displayIngredient(ing, servings, recipe.servings);
          const extra = [d.note, ing.optional ? s.optional : ''].filter(Boolean).join(', ');
          return [
            { text: d.amount, bold: true, alignment: 'right', noWrap: true },
            { text: [d.name, ...(extra ? [{ text: ` (${extra})`, color: MUTED }] : [])] },
          ];
        }),
      },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 8, paddingTop: () => 1, paddingBottom: () => 1 },
    },
  ]);

  let n = 0;
  const steps: Content[] = recipe.stepGroups.flatMap((g): Content[] => [
    ...(g.title ? [{ text: g.title, style: 'h3' } as Content] : []),
    ...g.steps.map((step): Content => {
      n += 1;
      return {
        columns: [
          { text: `${n}.`, width: 18, bold: true },
          {
            width: '*',
            stack: [
              { text: step.text },
              ...(step.thermomix ?? []).map((x) => ({ text: formatThermomixSetting(x), color: TM, bold: true, fontSize: 9.5, margin: [0, 2, 0, 0] }) as Content),
            ],
          },
        ],
        margin: [0, 0, 0, 7],
        unbreakable: true,
      };
    }),
  ]);

  const notes = recipe.notes.filter((x) => x.kind !== 'cooked' && (includeNotes || x.origin === 'source') && x.text);
  const cooked = includeNotes ? cookedDates(recipe) : [];
  const notesContent: Content[] =
    notes.length || cooked.length
      ? [
          { text: s.notes, style: 'h2' },
          ...(cooked.length ? [{ text: `${s.cookedOn}: ${cooked.map(formatDate).join(' · ')}`, color: MUTED, margin: [0, 0, 0, 6] } as Content] : []),
          ...notes.map(
            (x): Content => ({
              stack: [
                ...(x.origin === 'source' || x.date
                  ? [{ text: [x.origin === 'source' ? s.tip : '', x.date ? formatDate(x.date) : ''].filter(Boolean).join(' · '), color: MUTED, fontSize: 9 } as Content]
                  : []),
                { text: x.text ?? '' },
              ],
              margin: [0, 0, 0, 6],
              unbreakable: true,
            }),
          ),
        ]
      : [];

  return {
    info: { title: recipe.title },
    pageSize: 'A4',
    pageMargins: [45, 45, 45, 45],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.25, color: '#2B2622' },
    styles: {
      h1: { fontSize: 20, bold: true, margin: [0, 0, 0, 2] },
      h2: { fontSize: 13, bold: true, color: ACCENT, margin: [0, 12, 0, 6] },
      h3: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 3] },
    },
    content: [
      { text: recipe.title, style: 'h1' },
      ...(byline ? [{ text: byline, color: MUTED } as Content] : []),
      ...(meta.length ? [{ text: meta.join('  ·  '), color: MUTED } as Content] : []),
      ...(recipe.description ? [{ text: recipe.description, margin: [0, 8, 0, 0] } as Content] : []),
      {
        columns: [
          { width: '38%', stack: [{ text: [s.ingredients, { text: `  (${s.servingsFor(servings)})`, fontSize: 9, color: MUTED, bold: false }], style: 'h2' }, ...ingredients] },
          { width: '*', stack: [{ text: s.preparation, style: 'h2' }, ...steps] },
        ],
        columnGap: 20,
      },
      ...notesContent,
      ...(src?.url || byline
        ? [
            {
              text: [{ text: `${s.source}: `, bold: true }, byline, ...(src?.url ? ['\n', { text: src.url, link: src.url, color: ACCENT }] : [])],
              fontSize: 9,
              color: MUTED,
              margin: [0, 14, 0, 0],
            } as Content,
          ]
        : []),
    ],
  };
}
