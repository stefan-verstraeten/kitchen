import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import { DROPBOX_APP_KEY, WEB_BASE_PATH } from '../config';
import { secure } from './secure';

WebBrowser.maybeCompleteAuthSession();

export { DROPBOX_APP_KEY };

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://www.dropbox.com/oauth2/authorize',
  tokenEndpoint: 'https://api.dropboxapi.com/oauth2/token',
  revocationEndpoint: 'https://api.dropboxapi.com/2/auth/token/revoke',
};

const REFRESH_TOKEN_KEY = 'dropbox.refreshToken';

export const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kitchen', path: 'oauth' });

/**
 * Keeps a short-lived access token fresh using the long-lived refresh token
 * kept in the device's secure storage.
 */
export class DropboxTokens {
  private accessToken?: string;
  private expiresAt = 0;
  private refreshing?: Promise<string>;

  async hasSession(): Promise<boolean> {
    return !!(await secure.get(REFRESH_TOKEN_KEY));
  }

  async store(response: { accessToken: string; refreshToken?: string; expiresIn?: number }) {
    if (response.refreshToken) await secure.set(REFRESH_TOKEN_KEY, response.refreshToken);
    this.accessToken = response.accessToken;
    this.expiresAt = Date.now() + ((response.expiresIn ?? 3600) - 60) * 1000;
  }

  getAccessToken = async (): Promise<string> => {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    this.refreshing ??= (async () => {
      try {
        const refreshToken = await secure.get(REFRESH_TOKEN_KEY);
        if (!refreshToken) throw new Error('Not connected to Dropbox');
        const res = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: DROPBOX_APP_KEY });
        await this.store(res);
        return res.accessToken;
      } finally {
        this.refreshing = undefined;
      }
    })();
    return this.refreshing;
  };

  async signOut() {
    const token = this.accessToken;
    this.accessToken = undefined;
    this.expiresAt = 0;
    await secure.remove(REFRESH_TOKEN_KEY);
    if (token) {
      await fetch(discovery.revocationEndpoint!, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(
        () => undefined,
      );
    }
  }
}

/** POST to Dropbox's token endpoint (works from the app and from the browser). */
async function tokenRequest(params: Record<string, string>): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const res = await fetch(discovery.tokenEndpoint!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !body.access_token) throw new Error(`Dropbox: ${body.error_description ?? body.error ?? res.status}`);
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in };
}

// ---- Web (home-screen app): full-page redirect instead of a popup ----------
//
// A web app opened from the iPhone home screen cannot use popups reliably, so
// the browser goes to Dropbox and comes back to <base>/oauth (src/app/oauth.tsx).

const WEB_VERIFIER_KEY = 'dropbox.pkce';

export function webRedirectUri(): string {
  return `${window.location.origin}${WEB_BASE_PATH}/oauth`;
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function startWebSignIn() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  localStorage.setItem(WEB_VERIFIER_KEY, JSON.stringify({ verifier, state }));
  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    redirect_uri: webRedirectUri(),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    state,
  });
  window.location.assign(`${discovery.authorizationEndpoint}?${params}`);
}

/** Called by the /oauth page with the parameters Dropbox sent back. */
export async function completeWebSignIn(tokens: DropboxTokens, params: { code?: string; state?: string; error?: string }) {
  const saved = JSON.parse(localStorage.getItem(WEB_VERIFIER_KEY) ?? 'null') as { verifier: string; state: string } | null;
  localStorage.removeItem(WEB_VERIFIER_KEY);
  if (params.error) throw new Error(`Dropbox: ${params.error}`);
  if (!params.code || !saved || saved.state !== params.state) throw new Error('Aanmelden bij Dropbox is niet gelukt. Probeer opnieuw.');
  const res = await tokenRequest({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: DROPBOX_APP_KEY,
    redirect_uri: webRedirectUri(),
    code_verifier: saved.verifier,
  });
  await tokens.store(res);
}

/** Hook driving the Dropbox OAuth (authorization code + PKCE) flow. */
export function useDropboxSignIn(tokens: DropboxTokens, onConnected: () => void) {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: DROPBOX_APP_KEY,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      scopes: [],
      extraParams: { token_access_type: 'offline' },
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;
    AuthSession.exchangeCodeAsync(
      {
        clientId: DROPBOX_APP_KEY,
        code: response.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
    )
      .then((tokenResponse) => tokens.store(tokenResponse))
      .then(onConnected)
      .catch((e) => console.warn('Dropbox sign-in failed', e));
  }, [response, request, tokens, onConnected]);

  const signIn = useCallback(() => (Platform.OS === 'web' ? startWebSignIn() : promptAsync()), [promptAsync]);
  return { ready: !!DROPBOX_APP_KEY && (Platform.OS === 'web' || !!request), signIn };
}
