import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { buildIngredientIndex } from '../../domain/ingredientIndex';
import { t } from '../../domain/localized';
import { useApp } from '../../state/AppContext';
import { RecipeCard } from '../../ui/components';
import { ui } from '../../ui/theme';

export default function IngredientScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { recipes, lang } = useApp();
  const entry = useMemo(() => buildIngredientIndex(recipes).find((e) => e.key === key), [recipes, key]);
  const matching = recipes.filter((r) => entry?.recipeIds.includes(r.id));

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Stack.Screen options={{ title: entry ? t(entry.name, lang) : '' }} />
      <View style={{ gap: 12 }}>
        {matching.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </View>
    </ScrollView>
  );
}
