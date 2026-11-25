import { displayIngredient } from '../domain/display';
import { cookedDates } from '../domain/recipe';
import { formatThermomixSetting } from '../domain/thermomix';
import type { Recipe } from '../domain/types';
import { s } from '../ui/strings';

function esc(s: string | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface PdfOptions {
  servings: number;
  /** Include cooked dates and personal notes (tips from the source are always included). */
  includeNotes?: boolean;
}

/** Printable HTML for a recipe, used to produce the PDF. */
export function recipeToHtml(recipe: Recipe, { servings, includeNotes = true }: PdfOptions): string {
  const times = recipe.times ?? {};
  const meta = [
    times.prepMinutes ? `${s.prep}: ${s.minutes(times.prepMinutes)}` : '',
    times.cookMinutes ? `${s.cook}: ${s.minutes(times.cookMinutes)}` : '',
    times.totalMinutes ? `${s.total}: ${s.minutes(times.totalMinutes)}` : '',
    recipe.thermomix ? s.thermomix : '',
  ].filter(Boolean);

  const ingredients = recipe.ingredientGroups
    .map((g) => {
      const rows = g.items
        .map((ing) => {
          const d = displayIngredient(ing, servings, recipe.servings);
          const extra = [d.note, ing.optional ? s.optional : ''].filter(Boolean).join(', ');
          return `<tr><td class="amt">${esc(d.amount)}</td><td>${esc(d.name)}${extra ? ` <span class="muted">(${esc(extra)})</span>` : ''}</td></tr>`;
        })
        .join('');
      return `${g.title ? `<h3>${esc(g.title)}</h3>` : ''}<table class="ing">${rows}</table>`;
    })
    .join('');

  let n = 0;
  const steps = recipe.stepGroups
    .map((g) => {
      const items = g.steps
        .map((step) => {
          n += 1;
          const tm = (step.thermomix ?? []).map((x) => `<div class="tm">${esc(formatThermomixSetting(x))}</div>`).join('');
          return `<li value="${n}"><p>${esc(step.text)}</p>${tm}</li>`;
        })
        .join('');
      return `${g.title ? `<h3>${esc(g.title)}</h3>` : ''}<ol class="steps">${items}</ol>`;
    })
    .join('');

  const notes = recipe.notes.filter((x) => x.kind !== 'cooked' && (includeNotes || x.origin === 'source') && x.text);
  const cooked = includeNotes ? cookedDates(recipe) : [];
  const notesHtml =
    notes.length || cooked.length
      ? `<h2>${esc(s.notes)}</h2>${cooked.length ? `<p class="muted">${esc(s.cookedOn)}: ${cooked.map((d) => esc(formatDate(d))).join(' · ')}</p>` : ''}${notes
          .map(
            (x) =>
              `<div class="note">${x.origin === 'source' || x.date ? `<div class="muted small">${esc([x.origin === 'source' ? s.tip : '', x.date ? formatDate(x.date) : ''].filter(Boolean).join(' · '))}</div>` : ''}${esc(x.text)}</div>`,
          )
          .join('')}`
      : '';

  const src = recipe.source;
  const sourceHtml =
    src && (src.author || src.siteName || src.url)
      ? `<div class="source"><strong>${esc(s.source)}:</strong> ${esc([src.author, src.siteName].filter(Boolean).join(' · '))}${src.url ? `<br><a href="${esc(src.url)}">${esc(src.url)}</a>` : ''}</div>`
      : '';

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${esc(recipe.title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #2B2622; font-size: 11.5pt; line-height: 1.45; margin: 0; }
  h1 { font-size: 22pt; margin: 0 0 4px; }
  h2 { font-size: 14pt; color: #B5532E; border-bottom: 1px solid #E8E0D6; padding-bottom: 3px; margin: 18px 0 8px; }
  h3 { font-size: 11.5pt; margin: 10px 0 4px; }
  .muted { color: #7A6F66; } .small { font-size: 9.5pt; }
  .meta { color: #7A6F66; margin: 2px 0 8px; }
  .hero { width: 100%; max-height: 230px; object-fit: cover; border-radius: 8px; margin: 8px 0; }
  .cols { display: flex; gap: 22px; align-items: flex-start; }
  .cols > .left { flex: 0 0 38%; } .cols > .right { flex: 1; }
  table.ing { border-collapse: collapse; width: 100%; }
  table.ing td { padding: 2px 0; vertical-align: top; }
  table.ing td.amt { white-space: nowrap; font-weight: 600; text-align: right; padding-right: 10px; width: 1%; }
  ol.steps { padding-left: 20px; margin: 0; } ol.steps li { margin-bottom: 8px; page-break-inside: avoid; } ol.steps p { margin: 0; }
  .tm { display: inline-block; background: #E1F3EC; color: #00865A; font-weight: 600; font-size: 10pt; border-radius: 6px; padding: 2px 8px; margin-top: 4px; }
  .note { border-left: 3px solid #F5E4DA; padding: 2px 0 2px 10px; margin: 6px 0; page-break-inside: avoid; }
  .source { margin-top: 18px; font-size: 10pt; color: #7A6F66; word-break: break-all; }
  @media (max-width: 500px) { .cols { display: block; } }
</style></head><body>
<h1>${esc(recipe.title)}</h1>
${src?.author || src?.siteName ? `<div class="meta">${esc([src?.author, src?.siteName].filter(Boolean).join(' · '))}</div>` : ''}
${meta.length ? `<div class="meta">${esc(meta.join('  ·  '))}</div>` : ''}
${recipe.imageUrl ? `<img class="hero" src="${esc(recipe.imageUrl)}">` : ''}
${recipe.description ? `<p>${esc(recipe.description)}</p>` : ''}
<div class="cols">
  <div class="left"><h2>${esc(s.ingredients)} <span class="muted small">(${esc(s.servingsFor(servings))})</span></h2>${ingredients}</div>
  <div class="right"><h2>${esc(s.preparation)}</h2>${steps}</div>
</div>
${notesHtml}
${sourceHtml}
</body></html>`;
}
