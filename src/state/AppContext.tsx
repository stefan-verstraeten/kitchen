import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { secure } from '../storage/secure';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Lang, Recipe } from '../domain/types';
import { STRINGS, type Strings } from '../i18n/strings';
import { DropboxClient } from '../storage/dropbox';
import { DropboxTokens } from '../storage/dropboxAuth';
import { RecipeStore } from '../storage/recipeStore';

const LANG_KEY = 'kitchen:lang';
const API_KEY = 'claude.apiKey';

interface AppState {
  lang: Lang;
  setLang(lang: Lang): void;
  s: Strings;
  recipes: Recipe[];
  store: RecipeStore;
  ready: boolean;
  apiKey?: string;
  setApiKey(key: string | undefined): Promise<void>;
  tokens: DropboxTokens;
  dropboxAccount?: string;
  dropboxConnected: boolean;
  onDropboxConnected(): void;
  disconnectDropbox(): Promise<void>;
  sync(): Promise<void>;
  syncing: boolean;
  lastSync?: Date;
  syncError?: string;
  pending: number;
}

const Ctx = createContext<AppState | null>(null);

function deviceLang(): Lang {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'nl';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tokens] = useState(() => new DropboxTokens());
  const [store] = useState(() => new RecipeStore(AsyncStorage));

  const [lang, setLangState] = useState<Lang>(deviceLang);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKeyState] = useState<string>();
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [dropboxAccount, setDropboxAccount] = useState<string>();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date>();
  const [syncError, setSyncError] = useState<string>();
  const [pending, setPending] = useState(0);

  useEffect(
    () =>
      store.subscribe(() => {
        setRecipes(store.all());
        setPending(store.pendingCount());
      }),
    [store],
  );

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(undefined);
    try {
      await store.sync();
      setLastSync(new Date());
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
      setPending(store.pendingCount());
    }
  }, [store]);

  const connect = useCallback(async () => {
    const client = new DropboxClient(tokens.getAccessToken);
    store.setDropbox(client);
    setDropboxConnected(true);
    client
      .account()
      .then((a) => setDropboxAccount(a.name))
      .catch(() => undefined);
    await sync();
  }, [store, tokens, sync]);

  useEffect(() => {
    (async () => {
      const savedLang = await AsyncStorage.getItem(LANG_KEY);
      if (savedLang === 'nl' || savedLang === 'en') setLangState(savedLang);
      setApiKeyState((await secure.get(API_KEY)) ?? undefined);
      await store.load();
      setReady(true);
      if (await tokens.hasSession()) await connect();
    })().catch((e) => {
      console.warn(e);
      setReady(true);
    });
  }, [store, tokens, connect]);

  const value = useMemo<AppState>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        AsyncStorage.setItem(LANG_KEY, l).catch(() => undefined);
      },
      s: STRINGS[lang],
      recipes,
      store,
      ready,
      apiKey,
      setApiKey: async (key) => {
        if (key) await secure.set(API_KEY, key);
        else await secure.remove(API_KEY);
        setApiKeyState(key);
      },
      tokens,
      dropboxAccount,
      dropboxConnected,
      onDropboxConnected: () => void connect(),
      disconnectDropbox: async () => {
        await tokens.signOut();
        store.setDropbox(undefined);
        setDropboxConnected(false);
        setDropboxAccount(undefined);
      },
      sync,
      syncing,
      lastSync,
      syncError,
      pending,
    }),
    [lang, recipes, store, ready, apiKey, tokens, dropboxAccount, dropboxConnected, connect, sync, syncing, lastSync, syncError, pending],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
