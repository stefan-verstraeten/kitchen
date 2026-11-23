import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../domain/localized';
import { cookedDates } from '../domain/recipe';
import { formatThermomixSetting } from '../domain/thermomix';
import type { Lang, Recipe, ThermomixSetting } from '../domain/types';
import { useApp } from '../state/AppContext';
import { colors, ui } from './theme';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const bg = kind === 'primary' ? colors.accent : kind === 'danger' ? colors.card : colors.accentSoft;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? colors.danger : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        kind === 'danger' && { borderWidth: 1, borderColor: colors.danger },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
        >
          <Text style={[styles.segmentText, o.value === value && styles.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function LanguageToggle() {
  const { lang, setLang } = useApp();
  return (
    <Segmented
      options={[
        { value: 'nl', label: 'NL' },
        { value: 'en', label: 'EN' },
      ]}
      value={lang}
      onChange={(l) => setLang(l as Lang)}
    />
  );
}

export function ThermomixBadge() {
  const { s } = useApp();
  return (
    <View style={[ui.pill, { backgroundColor: colors.tmSoft }]}>
      <Text style={{ color: colors.tm, fontSize: 12, fontWeight: '600' }}>{s.thermomix}</Text>
    </View>
  );
}

export function ThermomixChip({ setting, lang }: { setting: ThermomixSetting; lang: Lang }) {
  return (
    <View style={styles.tmChip}>
      <Text style={styles.tmChipText}>⚙︎ {formatThermomixSetting(setting, lang)}</Text>
    </View>
  );
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { lang, s } = useApp();
  const cooked = cookedDates(recipe);
  return (
    <Link href={{ pathname: '/recipe/[id]', params: { id: recipe.id } }} asChild>
      <Pressable style={ui.card}>
        <View style={styles.recipeCard}>
          {recipe.imageUrl ? <Image source={{ uri: recipe.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={ui.h3} numberOfLines={2}>
              {t(recipe.title, lang)}
            </Text>
            {(recipe.source?.author || recipe.source?.siteName) && (
              <Text style={ui.muted} numberOfLines={1}>
                {[recipe.source?.author, recipe.source?.siteName].filter(Boolean).join(' · ')}
              </Text>
            )}
            <View style={ui.row}>
              {recipe.thermomix && <ThermomixBadge />}
              {cooked.length > 0 && <Text style={ui.muted}>{s.timesCooked(cooked.length)}</Text>}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.h2}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  segmented: { flexDirection: 'row', backgroundColor: colors.accentSoft, borderRadius: 10, padding: 3 },
  segment: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { color: colors.accent, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
  tmChip: { backgroundColor: colors.tmSoft, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
  tmChipText: { color: colors.tm, fontWeight: '600', fontSize: 14 },
  recipeCard: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  thumbEmpty: { backgroundColor: colors.accentSoft },
});
