/**
 * Key of the Dropbox app "KitchenDB" (Dropbox App Console › Settings › App key).
 * Not a secret: sign-in uses OAuth with PKCE, so no app secret is involved.
 * EXPO_PUBLIC_DROPBOX_APP_KEY (e.g. in .env) overrides it, to test with another Dropbox app.
 */
export const DROPBOX_APP_KEY: string = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY || 'uqlt2cpvjt5a7l8';


/**
 * Path under which the web app is published (GitHub Pages:
 * https://stefan-verstraeten.github.io/kitchen/). Must match
 * `expo.experiments.baseUrl` in app.json.
 */
export const WEB_BASE_PATH = '/kitchen';
