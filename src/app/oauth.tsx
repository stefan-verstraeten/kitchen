import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { completeWebSignIn } from '../storage/dropboxAuth';
import { useApp } from '../state/AppContext';
import { Button } from '../ui/components';
import { s } from '../ui/strings';
import { colors, ui } from '../ui/theme';

/**
 * Dropbox sends the browser back here after signing in (web app only; the
 * phone app handles the redirect inside its sign-in window).
 */
export default function OAuthReturnScreen() {
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const { tokens, onDropboxConnected } = useApp();
  const [error, setError] = useState<string>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (Platform.OS !== 'web') {
      router.replace('/settings');
      return;
    }
    completeWebSignIn(tokens, params)
      .then(() => {
        onDropboxConnected();
        router.replace('/settings');
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [params, tokens, onDropboxConnected]);

  return (
    <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }]}>
      {error ? (
        <>
          <Text style={[ui.body, { color: colors.danger, textAlign: 'center' }]}>{error}</Text>
          <Button title={s.settings} onPress={() => router.replace('/settings')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text style={ui.muted}>{s.dropboxConnecting}</Text>
        </>
      )}
    </View>
  );
}
