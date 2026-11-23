import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { buildIngredientIndex, searchIngredientIndex } from '../../domain/ingredientIndex';
import { resolve } from '../../domain/localized';
import { useApp } from '../../state/AppContext';
import { colors, ui } from '../../ui/theme';

export default function IngredientIndexScreen() {
  const { recipes, lang, s } = useApp();
  const [query, setQuery] = useState('');
  const index = useMemo(() => buildIngredientIndex(recipes), [recipes]);
  const results = useMemo(() => searchIngredientIndex(index, query, lang), [index, query, lang]);

  return (
    <View style={ui.screen}>
      <FlatList
        data={results}
        keyExtractor={(e) => e.key}
        contentContainerStyle={[ui.content, { gap: 0 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <TextInput
            style={[ui.input, { marginBottom: 12 }]}
            placeholder={s.searchIngredients}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        }
        ListEmptyComponent={<Text style={[ui.muted, { textAlign: 'center', marginTop: 32 }]}>{s.noResults}</Text>}
        renderItem={({ item }) => {
          const name = resolve(item.name, lang);
          return (
            <Link href={{ pathname: '/ingredient/[key]', params: { key: item.key } }} asChild>
              <Pressable
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={[ui.row, { justifyContent: 'space-between' }]}>
                  <Text style={[ui.body, name?.isFallback && { fontStyle: 'italic' }]}>{name?.text}</Text>
                  <Text style={ui.muted}>{s.ingredientUsedIn(item.recipeIds.length)}</Text>
                </View>
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}
