# Kitchen — recipe database

A mobile app (iOS + Android, built with Expo / React Native) that imports recipes
from websites such as Cookidoo and Dagelijkse Kost, stores them in one uniform
format in your Dropbox. The app is in Dutch. Recipes are kept in the
language they were imported or typed in, which will normally be Dutch.

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
  mode) are stored as structured data and shown in a fixed format, e.g. `3 min / 100 °C / omgekeerde draairichting / snelheid lepel`.
- **Notes**: log the days you cooked a recipe ("Cooked today"), add dated or
  undated notes, and keep tips taken from the source. Long-press a note to
  delete it.
- **Source**: the cook/author, the site, and a link to the original page.
- **Editor**: tap **Edit** on a recipe, or **Add → Write a recipe yourself**.
  Ingredients are typed one per line, for 4 people (e.g. `200 g bloem, gezeefd`).
  Steps can be added, reordered and removed, and Thermomix settings typed in a
  step (`5 sec./snelheid 5`) are recognised as you type.
- **Share as PDF**: the **PDF** button on a recipe creates a PDF for the
  number of people currently selected, and opens the share
  sheet, so you can send it to WhatsApp, Mail or Messages, or save it to Files.
- **Ingredient index**: a searchable list of every ingredient across all your
  recipes. Different spellings of common ingredients are grouped ("ui",
  "uien" and "ajuin" are one entry), and tapping an ingredient lists the
  recipes that use it.

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

### 2. Claude API key (optional)

Pages with schema.org recipe data are read on the phone without any key. For
pages without that data, and for recipe text you paste in (e.g. from the
Cookidoo app), the app asks Claude to structure the recipe. For that, enter a
key from <https://platform.claude.com> under **Instellingen → Claude
API-sleutel**. It is stored in the iOS Keychain / Android Keystore. Nothing is
translated: the recipe stays in the language of the source.

## Data format

`Apps/Kitchen/recipes/<id>.json` (see `src/domain/types.ts`):

```jsonc
{
  "schemaVersion": 2,
  "id": "tomatensoep-met-balletjes-ymohfg",
  "title": "Tomatensoep met balletjes",
  "servings": 4,                 // quantities below are for 4 people
  "originalServings": 4,
  "thermomix": true,
  "ingredientGroups": [{ "items": [
    { "key": "onion", "name": "ui", "quantity": 1, "note": "gehalveerd" },
    { "key": "canned-tomatoes", "name": "tomatenblokjes", "quantity": 800, "unit": "g" }
  ]}],
  "stepGroups": [{ "steps": [
    { "text": "Ui in de mengkom doen en 5 sec./snelheid 5 fijnhakken.",
      "thermomix": [{ "timeSeconds": 5, "speed": 5, "raw": "5 sec./snelheid 5" }] }
  ]}],
  "notes": [
    { "id": "n-…", "kind": "cooked", "date": "2026-11-16", "origin": "user" },
    { "id": "n-…", "kind": "tip", "text": "…", "origin": "source" }
  ],
  "source": { "url": "https://cookidoo.be/…", "siteName": "Cookidoo", "author": "Vorwerk Thermomix", "importedAt": "…" }
}
```

Files in the earlier two-language format (`schemaVersion: 1`) are converted
automatically when the app reads them (Dutch text kept, English used only
where there was no Dutch) and written back in the current format.

## Project layout

```
src/
  app/        screens (Expo Router): recipe list, ingredient index, import, settings, recipe page
  domain/     recipe model, quantity scaling, units, Thermomix parser, ingredient catalog & index
  import/     HTML / JSON-LD parsing, site profiles, Claude extraction
  storage/    Dropbox API client, OAuth (PKCE), offline-first sync
  ui/         shared components, theme and all interface text (strings.ts)
  export/     printable HTML and PDF sharing
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
