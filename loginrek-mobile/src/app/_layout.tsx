import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setAccessToken, setUnauthorizedHandler } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { userStore } from '@/lib/user-store';
import { colors } from '@/theme/colors';

/**
 * Root layout (Expo Router). Nanti di sini: provider auth + React Query,
 * dan pemisahan grup route (auth) vs (app).
 */
export default function RootLayout() {
  // Token ditolak server (kedaluwarsa/dicabut): bersihkan sesi lalu minta login ulang.
  // Antrean absen offline tidak dihapus dan akan dikirim setelah login berikutnya.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccessToken(null);
      void tokenStorage.clear();
      void userStore.clearCurrentUser();
      router.replace('/(auth)/login');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen
          name="(app)/attendance"
          options={{
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
