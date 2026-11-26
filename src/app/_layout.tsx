import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '../state/AppContext';
import { colors } from '../ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.text },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="recipe/[id]" options={{ title: '' }} />
          <Stack.Screen name="ingredient/[key]" options={{ title: '' }} />
          <Stack.Screen name="edit/[id]" options={{ title: '' }} />
          <Stack.Screen name="oauth" options={{ title: 'Dropbox', headerShown: false }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
