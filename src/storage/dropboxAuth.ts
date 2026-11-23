import * as AuthSession from 'expo-auth-session';
import { secure } from './secure';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect } from 'react';

WebBrowser.maybeCompleteAuthSession();

/** Key of the Dropbox app (App console › "App key"). Public; PKCE needs no secret. */
export const DROPBOX_APP_KEY = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY ?? '';

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

  async store(response: AuthSession.TokenResponse) {
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
        const res = await AuthSession.refreshAsync({ clientId: DROPBOX_APP_KEY, refreshToken }, discovery);
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

  const signIn = useCallback(() => promptAsync(), [promptAsync]);
  return { ready: !!request && !!DROPBOX_APP_KEY, signIn };
}
