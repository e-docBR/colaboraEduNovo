/**
 * Root layout — sets up auth guard, TanStack Query, and navigation theme.
 * - If not authenticated → redirects to /(auth)/login
 * - If authenticated → allows access to /(tabs)
 */
import '../global.css';
import { useEffect } from 'react';
import { router, Slot, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from '@/components/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useAuthStore } from '../lib/auth.store';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const rehydrate = useAuthStore((s) => s.rehydrate);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const colorScheme = useColorScheme();

  // Rehydrate auth state from SecureStore on boot
  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  // Once loaded, hide splash and route accordingly
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
      }
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return null; // SplashScreen is still visible
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
