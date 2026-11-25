import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { slugify } from '../domain/text';
import type { Recipe } from '../domain/types';
import { recipeToHtml, type PdfOptions } from './recipeHtml';

/**
 * Render the recipe to a PDF and open the system share sheet, from which the
 * user can send it to WhatsApp, Mail, Messages, save it to Files, etc.
 */
export async function shareRecipePdf(recipe: Recipe, options: PdfOptions & { dialogTitle?: string }): Promise<void> {
  const html = recipeToHtml(recipe, options);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  // Give the file a readable name; it is what the recipient sees in WhatsApp.
  const name = `${slugify(recipe.title) || 'recept'}.pdf`;
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  await new File(uri).move(target);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: options.dialogTitle });
}
