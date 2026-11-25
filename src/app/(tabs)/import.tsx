import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';

import type { Recipe } from '../../domain/types';
import { importFromText, importFromUrl, ImportError } from '../../import/importRecipe';
import { useApp } from '../../state/AppContext';
import { Button, Segmented } from '../../ui/components';
import { s } from '../../ui/strings';
import { colors, ui } from '../../ui/theme';

type Mode = 'url' | 'text';

export default function ImportScreen() {
  const { apiKey, store } = useApp();
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const finish = async (recipe: Recipe) => {
    await store.save(recipe);
    setUrl('');
    setText('');
    setSourceUrl('');
    setAuthor('');
    router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } });
  };

  const run = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'url') {
        await finish(await importFromUrl(url.trim(), { apiKey }));
      } else {
        await finish(await importFromText(text, { apiKey, url: sourceUrl.trim() || undefined, author: author.trim() || undefined }));
      }
    } catch (e) {
      if (e instanceof ImportError) setError([e.message, e.hint].filter(Boolean).join('\n\n'));
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const canRun = mode === 'url' ? /^https?:\/\/\S+$/i.test(url.trim()) : text.trim().length > 20 && !!apiKey;

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Segmented<Mode>
          options={[
            { value: 'url', label: s.importFromUrl },
            { value: 'text', label: s.pasteText },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === 'url' ? (
          <TextInput
            style={ui.input}
            placeholder={s.urlPlaceholder}
            placeholderTextColor={colors.muted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={() => canRun && run()}
          />
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={ui.muted}>{s.pasteTextHelp}</Text>
            <TextInput
              style={[ui.input, { minHeight: 200, textAlignVertical: 'top' }]}
              multiline
              value={text}
              onChangeText={setText}
            />
            <TextInput
              style={ui.input}
              placeholder={s.pasteSourceUrl}
              placeholderTextColor={colors.muted}
              value={sourceUrl}
              onChangeText={setSourceUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput style={ui.input} placeholder={s.pasteAuthor} placeholderTextColor={colors.muted} value={author} onChangeText={setAuthor} />
          </View>
        )}

        {!apiKey && <Text style={ui.muted}>{s.needsApiKey}</Text>}

        <Button title={busy ? s.importing : s.importButton} onPress={run} disabled={!canRun} busy={busy} />

        {error && (
          <View style={[ui.card, { borderColor: colors.danger }]}>
            <Text style={[ui.body, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          <Button title={s.writeYourself} kind="secondary" onPress={() => router.push({ pathname: '/edit/[id]', params: { id: 'new' } })} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
