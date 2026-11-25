import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native';

import { searchRecipes } from '../../domain/ingredientIndex';
import { useApp } from '../../state/AppContext';
import { RecipeCard } from '../../ui/components';
import { s } from '../../ui/strings';
import { colors, ui } from '../../ui/theme';

export default function RecipesScreen() {
  const { recipes, dropboxConnected, sync, syncing } = useApp();
  const [query, setQuery] = useState('');

  const list = useMemo(
    () => searchRecipes(recipes, query).sort((a, b) => a.title.localeCompare(b.title, 'nl')),
    [recipes, query],
  );

  return (
    <View style={ui.screen}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={dropboxConnected ? <RefreshControl refreshing={syncing} onRefresh={sync} tintColor={colors.accent} /> : undefined}
        ListHeaderComponent={
          <View style={{ gap: 6 }}>
            <TextInput
              style={ui.input}
              placeholder={s.searchRecipes}
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            <Text style={ui.muted}>{s.recipesCount(list.length)}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={[ui.muted, { textAlign: 'center', marginTop: 32 }]}>{recipes.length ? s.noResults : s.noRecipes}</Text>}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
      />
    </View>
  );
}
