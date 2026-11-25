import { Tabs } from 'expo-router/tabs';
import { Text, type ColorValue } from 'react-native';

import { s } from '../../ui/strings';
import { colors } from '../../ui/theme';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: s.tabRecipes, tabBarIcon: icon('📖') }} />
      <Tabs.Screen name="ingredients" options={{ title: s.tabIngredients, tabBarIcon: icon('🥕') }} />
      <Tabs.Screen name="import" options={{ title: s.tabImport, tabBarIcon: icon('＋') }} />
      <Tabs.Screen name="settings" options={{ title: s.tabSettings, tabBarIcon: icon('⚙︎') }} />
    </Tabs>
  );
}
