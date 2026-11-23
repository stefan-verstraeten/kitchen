# Kitchen — bilingual recipe database

A mobile app (iOS + Android, built with Expo / React Native) that imports recipes
from websites such as Cookidoo and Dagelijkse Kost, stores them in one uniform
format in your Dropbox, and shows everything in Dutch or English.

## Features

- **Import from the web**: paste a recipe URL. Pages with schema.org recipe
  data (most recipe sites) are parsed on the device. For other pages, or for
  text pasted from the Cookidoo app or a cookbook, Claude extracts the recipe.
- **Uniform storage on Dropbox**: one JSON file per recipe in
  `Dropbox/Apps/Kitchen/recipes/`. The app works offline from a local copy and
  syncs both ways. If the same recipe changes on two devices, the versions are
  merged, so a "cooked on" date or a note is never lost.
- **Ingredients for 4 people**: quantities are converted to 4 servings when a
  recipe is imported. The recipe page has a − / + control to show amounts for
  any number of people. Amounts like "salt to taste" or a pinch don't scale.
- **Step-by-step method**: numbered steps, grouped by section when the source
  has sections.
- **Thermomix**: recipes made with the Vorwerk Thermomix are marked as such.
  Machine settings in a step (time, temperature or Varoma, reverse, speed or
  mode) are stored as structured data and shown in a fixed format in the
  chosen language, e.g. `3 min / 100 °C / omgekeerde draairichting / snelheid lepel`.
- **Notes**: log the days you cooked a recipe ("Cooked today"), add dated or
  undated notes, and keep tips taken from the source. Long-press a note to
  delete it.
- **Source**: the cook/author, the site, and a link to the original page.
- **Editor**: tap **Edit** on a recipe, or **Add → Write a recipe yourself**.
  Ingredients are typed one per line, for 4 people (e.g. `200 g bloem, gezeefd`).
  Steps can be added, reordered and removed, and Thermomix settings typed in a
  step (`5 sec./snelheid 5`) are recognised as you type. You edit the language
  the app is set to. A text you change loses its other-language version, and
  the app translates it again automatically if a Claude API key is set.
  Unchanged texts keep their translation.
- **Share as PDF**: the **PDF** button on a recipe creates a PDF in the current
  language, for the number of people currently selected, and opens the share
  sheet, so you can send it to WhatsApp, Mail or Messages, or save it to Files.
- **Ingredient index**: a searchable list of every ingredient across all your
  recipes. Search works in both languages ("ui", "ajuin" or "onion" all find
  the same entry), and tapping an ingredient lists the recipes that use it.
- **Dutch / English**: the interface, the recipes and the ingredient index can
  all be switched between Dutch and English. Recipes are translated when they
  are imported, if a Claude API key is set. A recipe that isn't translated yet
  is shown in its original language, with a "Translate" button.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the Dropbox app key
npx expo start
```

The app uses native modules (secure storage, the auth browser), so build a
development client instead of using Expo Go:
`npx expo run:ios`, `npx expo run:android`, or `npx eas-cli@latest build --profile development`.

### 1. Create the Dropbox app (one-time)

1. Go to <https://www.dropbox.com/developers/apps> → **Create app**.
2. Choose **Scoped access** → **App folder**, and name it `Kitchen` (the folder
   becomes `Dropbox/Apps/Kitchen`).
3. **Permissions** tab: enable `files.content.read`, `files.content.write`,
   `account_info.read`, then click **Submit**.
4. **Settings** tab → **OAuth 2 → Redirect URIs**: add `kitchen://oauth`
   (plus the `exp://…/--/oauth` URI that the dev server prints, if you test that way).
5. Copy the **App key** into `.env` as `EXPO_PUBLIC_DROPBOX_APP_KEY`.

Then open **Settings** in the app → **Connect Dropbox**.

### 2. Claude API key (optional, recommended)

Under **Settings → Claude API key**, enter a key from
<https://platform.claude.com>. It is stored in the iOS Keychain / Android
Keystore and used for:

- translating imported recipes, notes and ingredient names (NL ↔ EN);
- reading recipes from pages without structured data, and from pasted text.

Without a key, recipes from sites with schema.org data are still imported, in
their original language only.

## Data format

`Apps/Kitchen/recipes/<id>.json` (see `src/domain/types.ts`):

```jsonc
{
  "schemaVersion": 1,
  "id": "tomatensoep-met-balletjes-ymohfg",
  "title": { "nl": "Tomatensoep met balletjes", "en": "Tomato soup with meatballs" },
  "originalLanguage": "nl",
  "servings": 4,                 // quantities below are for 4 people
  "originalServings": 4,
  "thermomix": true,
  "ingredientGroups": [{ "items": [
    { "key": "onion", "name": { "nl": "ui", "en": "onion" }, "quantity": 1, "note": { "nl": "gehalveerd", "en": "halved" } },
    { "key": "canned-tomatoes", "name": { "nl": "tomatenblokjes", "en": "chopped tomatoes" }, "quantity": 800, "unit": "g" }
  ]}],
  "stepGroups": [{ "steps": [
    { "text": { "nl": "… 5 sec./snelheid 5 fijnhakken.", "en": "… chop 5 sec/speed 5." },
      "thermomix": [{ "timeSeconds": 5, "speed": 5, "raw": "5 sec./snelheid 5" }] }
  ]}],
  "notes": [
    { "id": "n-…", "kind": "cooked", "date": "2026-11-16", "origin": "user" },
    { "id": "n-…", "kind": "tip", "text": { "nl": "…", "en": "…" }, "origin": "source" }
  ],
  "source": { "url": "https://cookidoo.be/…", "siteName": "Cookidoo", "author": "Vorwerk Thermomix", "importedAt": "…" }
}
```

`Apps/Kitchen/ingredients.json` stores Dutch/English names for ingredients
that aren't in the built-in list (`src/domain/ingredientCatalog.ts`), so the
index shows the same names on every device.

## Project layout

```
src/
  app/        screens (Expo Router): recipe list, ingredient index, import, settings, recipe page
  domain/     recipe model, quantity scaling, units, Thermomix parser, ingredient catalog & index
  import/     HTML / JSON-LD parsing, site profiles, Claude extraction & translation
  storage/    Dropbox API client, OAuth (PKCE), offline-first sync
  export/     printable HTML and PDF sharing
  i18n/       UI text (nl/en)
tests/        vitest unit tests (parsing, scaling, index, sync/merge)
```

```bash
npm test            # unit tests
npm run typecheck
npm run lint
```

## Known limitations

- **Cookidoo** shows some recipes in full only after you sign in. When an
  import is incomplete, copy the recipe text from the Cookidoo app and use
  **Add → Paste text**.
- The site-specific parsing has only been tested against sample pages built
  from the schema.org recipe format, not against live Cookidoo or Dagelijkse
  Kost pages. Check the first few imports from each site.
- The PDF includes your personal notes and cooked dates.
