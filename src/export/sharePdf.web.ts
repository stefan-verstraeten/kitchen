import { slugify } from '../domain/text';
import type { Recipe } from '../domain/types';
import type { PdfOptions } from './recipeHtml';
import { recipeToPdfDefinition } from './recipePdf';

/**
 * Web version (used by the home-screen web app on iPhone): builds the PDF in
 * the browser and opens the share sheet (WhatsApp, Mail, Files, …). Falls
 * back to a download where the browser cannot share files.
 */
export async function shareRecipePdf(recipe: Recipe, options: PdfOptions & { dialogTitle?: string }): Promise<void> {
  // Loaded only when needed: the PDF library and its fonts are ~1.6 MB.
  const [pdfMakeModule, vfsModule] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  // Both are UMD bundles; depending on the bundler the API sits on `default`.
  const pdfMake = ((pdfMakeModule as { default?: unknown }).default ?? pdfMakeModule) as typeof pdfMakeModule;
  const vfs = ((vfsModule as { default?: unknown }).default ?? vfsModule) as Record<string, string>;
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.setFonts({
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  });

  const blob = await pdfMake.createPdf(recipeToPdfDefinition(recipe, options)).getBlob();
  const name = `${slugify(recipe.title) || 'recept'}.pdf`;
  const file = new File([blob], name, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: recipe.title });
    } catch (e) {
      // The user closing the share sheet is not an error.
      if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
