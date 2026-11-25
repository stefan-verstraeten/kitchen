import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { DROPBOX_APP_KEY, useDropboxSignIn } from '../../storage/dropboxAuth';
import { useApp } from '../../state/AppContext';
import { Button, Section } from '../../ui/components';
import { s } from '../../ui/strings';
import { colors, ui } from '../../ui/theme';

export default function SettingsScreen() {
  const app = useApp();
  const { ready, signIn } = useDropboxSignIn(app.tokens, app.onDropboxConnected);
  const [keyDraft, setKeyDraft] = useState('');

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Section title={s.dropbox}>
        <View style={[ui.card, { gap: 10 }]}>
          {!DROPBOX_APP_KEY ? (
            <Text style={ui.muted}>{s.dropboxNotConfigured}</Text>
          ) : app.dropboxConnected ? (
            <>
              <Text style={ui.body}>{s.dropboxConnectedAs(app.dropboxAccount ?? '…')}</Text>
              <Text style={ui.muted}>{s.dropboxFolder}</Text>
              {app.lastSync && <Text style={ui.muted}>{s.lastSync(app.lastSync.toLocaleString('nl-BE'))}</Text>}
              {app.pending > 0 && <Text style={ui.muted}>{s.pending(app.pending)}</Text>}
              {app.syncError && <Text style={{ color: colors.danger }}>{`${s.syncFailed}: ${app.syncError}`}</Text>}
              <Button title={app.syncing ? s.syncing : s.syncNow} onPress={app.sync} busy={app.syncing} />
              <Button title={s.dropboxDisconnect} kind="danger" onPress={app.disconnectDropbox} />
            </>
          ) : (
            <>
              <Text style={ui.muted}>{s.dropboxFolder}</Text>
              <Button title={s.dropboxConnect} onPress={signIn} disabled={!ready} />
            </>
          )}
        </View>
      </Section>

      <Section title={s.apiKey}>
        <View style={[ui.card, { gap: 10 }]}>
          <Text style={ui.muted}>{s.apiKeyHelp}</Text>
          {app.apiKey ? (
            <>
              <Text style={ui.body}>{`${s.apiKeySaved}: ${app.apiKey.slice(0, 10)}…`}</Text>
              <Button title={s.removeKey} kind="danger" onPress={() => app.setApiKey(undefined)} />
            </>
          ) : (
            <>
              <TextInput
                style={ui.input}
                placeholder={s.apiKeyPlaceholder}
                placeholderTextColor={colors.muted}
                value={keyDraft}
                onChangeText={setKeyDraft}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Button
                title={s.save}
                disabled={!keyDraft.trim()}
                onPress={async () => {
                  await app.setApiKey(keyDraft.trim());
                  setKeyDraft('');
                }}
              />
            </>
          )}
        </View>
      </Section>
    </ScrollView>
  );
}
