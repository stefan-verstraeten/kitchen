import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { displayIngredient } from '../../domain/display';
import { formatDate } from '../../export/recipeHtml';
import { shareRecipePdf } from '../../export/sharePdf';
import { addCookedDate, addNote, cookedDates, removeNote, todayIso } from '../../domain/recipe';
import type { Note, Recipe } from '../../domain/types';
import { useApp } from '../../state/AppContext';
import { Button, Section, ThermomixBadge, ThermomixChip } from '../../ui/components';
import { confirmAction, showMessage } from '../../ui/dialogs';
import { s } from '../../ui/strings';
import { colors, ui } from '../../ui/theme';

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 40;

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, recipes } = useApp();
  const recipe = recipes.find((r) => r.id === id);
  const [servings, setServings] = useState<number>(recipe?.servings ?? 4);
  const [noteText, setNoteText] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [sharing, setSharing] = useState(false);

  if (!recipe) return <View style={ui.screen} />;

  const save = (r: Recipe) => store.save(r);
  const cooked = cookedDates(recipe);
  const otherNotes = recipe.notes.filter((n) => n.kind !== 'cooked');
  const times = recipe.times ?? {};

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(noteDate.trim()) ? noteDate.trim() : undefined;
    const updated = addNote(recipe, text, { date });
    setNoteText('');
    setNoteDate('');
    await save(updated);
  };

  const sharePdf = async () => {
    setSharing(true);
    try {
      await shareRecipePdf(recipe, { servings, dialogTitle: s.sharePdf });
    } catch (e) {
      showMessage(s.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const confirmDelete = async () => {
    if (!(await confirmAction({ title: s.deleteRecipe, message: s.deleteConfirm, confirm: s.delete, cancel: s.cancel, destructive: true }))) return;
    await store.remove(recipe.id);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const confirmRemoveNote = async (note: Note) => {
    if (await confirmAction({ title: s.deleteNote, confirm: s.delete, cancel: s.cancel, destructive: true })) await save(removeNote(recipe, note.id));
  };

  // Steps are numbered continuously across groups.
  const stepOffsets = recipe.stepGroups.map((_, gi) => recipe.stepGroups.slice(0, gi).reduce((n, g) => n + g.steps.length, 0));

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={[ui.row, { gap: 18 }]}>
              <Pressable onPress={sharePdf} disabled={sharing} hitSlop={10} accessibilityRole="button" accessibilityLabel={s.sharePdf}>
                <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600', opacity: sharing ? 0.5 : 1 }}>{sharing ? s.makingPdf : 'PDF'}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/edit/[id]', params: { id: recipe.id } })}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>{s.edit}</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {recipe.imageUrl && <Image source={{ uri: recipe.imageUrl }} style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: 12 }} />}

      <Text style={ui.h1}>{recipe.title}</Text>
      {(recipe.source?.author || recipe.source?.siteName) && (
        <Text style={ui.muted}>{[recipe.source?.author, recipe.source?.siteName].filter(Boolean).join(' · ')}</Text>
      )}
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        {recipe.thermomix && <ThermomixBadge />}
        {times.prepMinutes ? <Text style={ui.muted}>{`${s.prep}: ${s.minutes(times.prepMinutes)}`}</Text> : null}
        {times.cookMinutes ? <Text style={ui.muted}>{`${s.cook}: ${s.minutes(times.cookMinutes)}`}</Text> : null}
        {times.totalMinutes ? <Text style={ui.muted}>{`${s.total}: ${s.minutes(times.totalMinutes)}`}</Text> : null}
      </View>

      {recipe.description && <Text style={ui.body}>{recipe.description}</Text>}

      <Section
        title={s.ingredients}
        right={
          <View style={ui.row}>
            <Stepper label="−" onPress={() => setServings((n) => Math.max(MIN_SERVINGS, n - 1))} />
            <Text style={[ui.h3, { minWidth: 92, textAlign: 'center' }]}>{s.servingsFor(servings)}</Text>
            <Stepper label="+" onPress={() => setServings((n) => Math.min(MAX_SERVINGS, n + 1))} />
          </View>
        }
      >
        <View style={ui.card}>
          {recipe.ingredientGroups.map((group, gi) => (
            <View key={gi} style={{ gap: 6, marginTop: gi ? 12 : 0 }}>
              {group.title && <Text style={ui.h3}>{group.title}</Text>}
              {group.items.map((ing, ii) => {
                const line = displayIngredient(ing, servings, recipe.servings);
                return (
                  <View key={ii} style={{ flexDirection: 'row', gap: 10 }}>
                    <Text style={[ui.body, { width: 96, fontWeight: '600', textAlign: 'right' }]}>{line.amount}</Text>
                    <Text style={[ui.body, { flex: 1 }]}>
                      {line.name}
                      {line.note ? <Text style={{ color: colors.muted }}>{`, ${line.note}`}</Text> : null}
                      {ing.optional ? <Text style={{ color: colors.muted }}>{` (${s.optional})`}</Text> : null}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        {recipe.originalServings && recipe.originalServings !== recipe.servings ? (
          <Text style={ui.muted}>{s.originalServings(recipe.originalServings)}</Text>
        ) : null}
      </Section>

      <Section title={s.preparation}>
        {recipe.stepGroups.map((group, gi) => (
          <View key={gi} style={{ gap: 10 }}>
            {group.title && <Text style={ui.h3}>{group.title}</Text>}
            {group.steps.map((step, si) => {
              const stepNumber = stepOffsets[gi] + si + 1;
              return (
                <View key={si} style={[ui.card, { gap: 8 }]}>
                  <Text style={[ui.muted, { fontWeight: '600' }]}>{s.step(stepNumber)}</Text>
                  <Text style={ui.body}>{step.text}</Text>
                  {step.thermomix?.map((tm, ti) => <ThermomixChip key={ti} setting={tm} />)}
                </View>
              );
            })}
          </View>
        ))}
      </Section>

      <Section title={s.notes}>
        <View style={[ui.card, { gap: 10 }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.h3}>{cooked.length ? s.timesCooked(cooked.length) : s.cookedOn}</Text>
            <Button title={s.cookedToday} kind="secondary" onPress={() => save(addCookedDate(recipe))} disabled={cooked.includes(todayIso())} />
          </View>
          {cooked.length > 0 && <Text style={ui.muted}>{cooked.map((d) => formatDate(d)).join(' · ')}</Text>}
        </View>

        {otherNotes.length === 0 && <Text style={ui.muted}>{s.noNotes}</Text>}
        {otherNotes.map((note) => {
          return (
            <Pressable key={note.id} onLongPress={() => confirmRemoveNote(note)} style={[ui.card, { gap: 4 }]}>
              {(note.origin === 'source' || note.date) && (
                <Text style={ui.muted}>{[note.origin === 'source' ? s.tip : undefined, note.date ? formatDate(note.date) : undefined].filter(Boolean).join(' · ')}</Text>
              )}
              <Text style={ui.body}>{note.text}</Text>
            </Pressable>
          );
        })}

        <View style={[ui.card, { gap: 8 }]}>
          <TextInput
            style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
            multiline
            placeholder={s.notePlaceholder}
            placeholderTextColor={colors.muted}
            value={noteText}
            onChangeText={setNoteText}
          />
          <TextInput
            style={ui.input}
            placeholder={s.noteDatePlaceholder}
            placeholderTextColor={colors.muted}
            value={noteDate}
            onChangeText={setNoteDate}
            keyboardType="numbers-and-punctuation"
          />
          <Button title={s.addNote} onPress={submitNote} disabled={!noteText.trim()} />
        </View>
      </Section>

      {recipe.source && (
        <Section title={s.source}>
          <View style={[ui.card, { gap: 6 }]}>
            {recipe.source.author && <Text style={ui.body}>{recipe.source.author}</Text>}
            {recipe.source.siteName && <Text style={ui.muted}>{recipe.source.siteName}</Text>}
            {recipe.source.url ? (
              <Pressable onPress={() => Linking.openURL(recipe.source!.url)}>
                <Text style={[ui.body, { color: colors.accent, textDecorationLine: 'underline' }]}>{s.openOriginal}</Text>
              </Pressable>
            ) : null}
          </View>
        </Section>
      )}

      <View style={{ marginTop: 24, gap: 10 }}>
        <Button title={sharing ? s.makingPdf : s.sharePdf} kind="secondary" onPress={sharePdf} busy={sharing} />
        <Button title={s.deleteRecipe} kind="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 20, color: colors.accent, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
