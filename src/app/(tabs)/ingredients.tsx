import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { buildIngredientIndex, searchIngredientIndex } from '../../domain/ingredientIndex';
import { useApp } from '../../state/AppContext';
import { s } from '../../ui/strings';
import { colors, ui } from '../../ui/theme';

export default function IngredientIndexScreen() {
  const { recipes } = useApp();
  const [query, setQuery] = useState('');
  const index = useMemo(() => buildIngredientIndex(recipes), [recipes]);
  const results = useMemo(() => searchIngredientIndex(index, query), [index, query]);

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
                  <Text style={ui.body}>{item.name}</Text>
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
