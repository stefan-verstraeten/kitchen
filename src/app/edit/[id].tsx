import { Stack, router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { editStep, ingredientsToText, textToIngredients } from '../../domain/editing';
import { emptyRecipe, newId, touch } from '../../domain/recipe';
import { clean } from '../../domain/text';
import { parseThermomixSettings } from '../../domain/thermomix';
import type { IngredientGroup, Recipe, Step, StepGroup } from '../../domain/types';
import { useApp } from '../../state/AppContext';
import { Button, Section, ThermomixChip } from '../../ui/components';
import { confirmAction, showMessage } from '../../ui/dialogs';
import { s } from '../../ui/strings';
import { colors, ui } from '../../ui/theme';

interface IngredientDraft {
  key: number;
  title: string;
  text: string;
  original?: IngredientGroup;
}
interface StepDraft {
  key: number;
  text: string;
}
interface StepGroupDraft {
  key: number;
  title: string;
  steps: StepDraft[];
  original?: StepGroup;
}

let nextKey = 1;
const k = () => nextKey++;
const minutes = (v?: number) => (v ? String(v) : '');
const toMinutes = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useApp();
  const isNew = id === 'new';
  const original = useMemo<Recipe>(() => (isNew ? emptyRecipe() : store.get(id)) ?? emptyRecipe(), [isNew, id, store]);

  const [title, setTitle] = useState(original.title);
  const [description, setDescription] = useState(original.description ?? '');
  const [thermomix, setThermomix] = useState(original.thermomix);
  const [prep, setPrep] = useState(minutes(original.times?.prepMinutes));
  const [cook, setCook] = useState(minutes(original.times?.cookMinutes));
  const [total, setTotal] = useState(minutes(original.times?.totalMinutes));
  const [author, setAuthor] = useState(original.source?.author ?? '');
  const [site, setSite] = useState(original.source?.siteName ?? '');
  const [url, setUrl] = useState(original.source?.url ?? '');
  const [image, setImage] = useState(original.imageUrl ?? '');
  const [ingGroups, setIngGroups] = useState<IngredientDraft[]>(() =>
    (original.ingredientGroups.length ? original.ingredientGroups : [{ items: [] }]).map((g) => ({
      key: k(),
      title: g.title ?? '',
      text: ingredientsToText(g),
      original: g,
    })),
  );
  const [stepGroups, setStepGroups] = useState<StepGroupDraft[]>(() =>
    (original.stepGroups.length ? original.stepGroups : [{ steps: [] }]).map((g) => ({
      key: k(),
      title: g.title ?? '',
      steps: (g.steps.length ? g.steps : [{ text: '' }]).map((st) => ({ key: k(), text: st.text })),
      original: g,
    })),
  );
  const [dirty, setDirty] = useState(false);
  const change =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setDirty(true);
    };

  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    confirmAction({ title: s.discardTitle, confirm: s.discard, cancel: s.keepEditing, destructive: true }).then((ok) => ok && repeat());
  });

  const build = (): Recipe => {
    // Steps are matched to the originals by their text, so unchanged steps are kept as they are.
    const originalSteps = new Map<string, Step>();
    for (const g of original.stepGroups) for (const st of g.steps) originalSteps.set(st.text.trim(), st);

    const ingredientGroups = ingGroups
      .map((g) => ({
        title: clean(g.title),
        items: textToIngredients(g.text, g.original?.items ?? []),
      }))
      .filter((g) => g.items.length || g.title);
    const newStepGroups = stepGroups
      .map((g) => ({
        title: clean(g.title),
        steps: g.steps.map((st) => editStep(originalSteps.get(st.text.trim()), st.text)).filter((st): st is Step => !!st),
      }))
      .filter((g) => g.steps.length || g.title);

    const hasSource = url.trim() || author.trim() || site.trim();
    return touch({
      ...original,
      id: isNew ? newId(title) : original.id,
      title: title.trim(),
      description: clean(description),
      thermomix,
      times: { prepMinutes: toMinutes(prep), cookMinutes: toMinutes(cook), totalMinutes: toMinutes(total) },
      imageUrl: image.trim() || undefined,
      ingredientGroups: ingredientGroups.length ? ingredientGroups : [{ items: [] }],
      stepGroups: newStepGroups,
      source: hasSource
        ? {
            url: url.trim(),
            author: author.trim() || undefined,
            siteName: site.trim() || undefined,
            importedAt: original.source?.importedAt ?? new Date().toISOString(),
          }
        : undefined,
    });
  };

  const save = async () => {
    if (!title.trim()) return showMessage(s.titleRequired);
    const recipe = build();
    await store.save(recipe);
    disablePrevention();
    setDirty(false);
    if (isNew) router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
    else if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
  };

  const updateStepGroup = (gi: number, fn: (g: StepGroupDraft) => StepGroupDraft) =>
    change(setStepGroups)(stepGroups.map((g, i) => (i === gi ? fn(g) : g)));
  const moveStep = (gi: number, si: number, delta: number) =>
    updateStepGroup(gi, (g) => {
      const steps = [...g.steps];
      const to = si + delta;
      if (to < 0 || to >= steps.length) return g;
      [steps[si], steps[to]] = [steps[to], steps[si]];
      return { ...g, steps };
    });

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: isNew ? s.newRecipe : s.edit,
          headerRight: () => (
            <Pressable onPress={save} hitSlop={10} accessibilityRole="button">
              <Text style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>{s.save}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Field label={s.title} value={title} onChange={change(setTitle)} />
        <Field label={s.description} value={description} onChange={change(setDescription)} multiline />

        <View style={[ui.card, ui.row, { justifyContent: 'space-between' }]}>
          <Text style={ui.body}>{s.thermomixRecipe}</Text>
          <Switch value={thermomix} onValueChange={change(setThermomix)} trackColor={{ true: colors.tm }} />
        </View>

        <Text style={ui.h3}>{s.timesMinutes}</Text>
        <View style={ui.row}>
          <Field label={s.prep} value={prep} onChange={change(setPrep)} numeric flex />
          <Field label={s.cook} value={cook} onChange={change(setCook)} numeric flex />
          <Field label={s.total} value={total} onChange={change(setTotal)} numeric flex />
        </View>

        <Section title={s.ingredients}>
          <Text style={ui.muted}>{s.ingredientsHelp}</Text>
          {ingGroups.map((g, gi) => (
            <View key={g.key} style={[ui.card, { gap: 8 }]}>
              {(ingGroups.length > 1 || g.title) && (
                <TextInput
                  style={ui.input}
                  placeholder={s.groupTitle}
                  placeholderTextColor={colors.muted}
                  value={g.title}
                  onChangeText={(v) => change(setIngGroups)(ingGroups.map((x, i) => (i === gi ? { ...x, title: v } : x)))}
                />
              )}
              <TextInput
                style={[ui.input, { minHeight: 160, textAlignVertical: 'top', lineHeight: 24 }]}
                multiline
                autoCorrect={false}
                value={g.text}
                onChangeText={(v) => change(setIngGroups)(ingGroups.map((x, i) => (i === gi ? { ...x, text: v } : x)))}
              />
              {ingGroups.length > 1 && (
                <SmallButton label={s.removeGroup} danger onPress={() => change(setIngGroups)(ingGroups.filter((_, i) => i !== gi))} />
              )}
            </View>
          ))}
          <SmallButton label={s.addGroup} onPress={() => change(setIngGroups)([...ingGroups, { key: k(), title: '', text: '' }])} />
        </Section>

        <Section title={s.preparation}>
          <Text style={ui.muted}>{s.stepTmHelp}</Text>
          {stepGroups.map((g, gi) => (
            <View key={g.key} style={{ gap: 8 }}>
              {(stepGroups.length > 1 || g.title) && (
                <TextInput
                  style={ui.input}
                  placeholder={s.groupTitle}
                  placeholderTextColor={colors.muted}
                  value={g.title}
                  onChangeText={(v) => updateStepGroup(gi, (x) => ({ ...x, title: v }))}
                />
              )}
              {g.steps.map((st, si) => {
                const tm = parseThermomixSettings(st.text);
                return (
                  <View key={st.key} style={[ui.card, { gap: 8 }]}>
                    <View style={[ui.row, { justifyContent: 'space-between' }]}>
                      <Text style={[ui.muted, { fontWeight: '600' }]}>{s.step(si + 1)}</Text>
                      <View style={ui.row}>
                        <IconButton label="↑" onPress={() => moveStep(gi, si, -1)} />
                        <IconButton label="↓" onPress={() => moveStep(gi, si, 1)} />
                        <IconButton label="✕" onPress={() => updateStepGroup(gi, (x) => ({ ...x, steps: x.steps.filter((_, i) => i !== si) }))} />
                      </View>
                    </View>
                    <TextInput
                      style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
                      multiline
                      placeholder={s.stepPlaceholder}
                      placeholderTextColor={colors.muted}
                      value={st.text}
                      onChangeText={(v) =>
                        updateStepGroup(gi, (x) => ({ ...x, steps: x.steps.map((y, i) => (i === si ? { ...y, text: v } : y)) }))
                      }
                    />
                    {tm.map((setting, ti) => (
                      <ThermomixChip key={ti} setting={setting} />
                    ))}
                  </View>
                );
              })}
              <View style={ui.row}>
                <SmallButton label={s.addStep} onPress={() => updateStepGroup(gi, (x) => ({ ...x, steps: [...x.steps, { key: k(), text: '' }] }))} />
                {stepGroups.length > 1 && (
                  <SmallButton label={s.removeGroup} danger onPress={() => change(setStepGroups)(stepGroups.filter((_, i) => i !== gi))} />
                )}
              </View>
            </View>
          ))}
          <SmallButton
            label={s.addGroup}
            onPress={() => change(setStepGroups)([...stepGroups, { key: k(), title: '', steps: [{ key: k(), text: '' }] }])}
          />
        </Section>

        <Section title={s.source}>
          <Field label={s.sourceAuthor} value={author} onChange={change(setAuthor)} />
          <Field label={s.sourceSite} value={site} onChange={change(setSite)} />
          <Field label={s.sourceUrl} value={url} onChange={change(setUrl)} url />
          <Field label={s.imageUrl} value={image} onChange={change(setImage)} url />
        </Section>

        <Button title={s.save} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  numeric,
  url,
  flex,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  url?: boolean;
  flex?: boolean;
}) {
  return (
    <View style={[{ gap: 4 }, flex && { flex: 1 }]}>
      <Text style={ui.muted}>{label}</Text>
      <TextInput
        style={[ui.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : url ? 'url' : 'default'}
        autoCapitalize={url ? 'none' : 'sentences'}
        autoCorrect={!url}
      />
    </View>
  );
}

function SmallButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: danger ? colors.card : colors.accentSoft,
        borderWidth: danger ? 1 : 0,
        borderColor: colors.danger,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: danger ? colors.danger : colors.accent, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: colors.accent, fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}
