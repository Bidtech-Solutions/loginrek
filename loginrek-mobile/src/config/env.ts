import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Base URL REST API (AdonisJS, prefix /api/v1).
 *
 * Urutan prioritas:
 * 1. EXPO_PUBLIC_API_URL  — di-set lewat .env.local (dev) atau eas.json (build).
 * 2. Deteksi otomatis saat development: pakai IP laptop yang menjalankan Metro
 *    (`npm run dev`), jadi iPhone/Android fisik di Wi-Fi yang sama langsung
 *    bisa mengakses API di laptop tanpa ubah kode.
 * 3. Fallback: IP lokal laptop (192.168.110.103) atau Android emulator 10.0.2.2.
 */
const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '3333';

function devApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:${API_PORT}/api/v1`;
  }

  // hostUri contoh: "192.168.110.103:8081"
  const rawHost =
    Constants.expoConfig?.hostUri?.split(':')[0] ??
    (Constants as Record<string, any>).manifest2?.extra?.expoClient?.hostUri?.split(':')[0] ??
    '192.168.110.103';

  // Mode --tunnel memberi host *.exp.direct yang tidak meneruskan port 3333.
  if (rawHost && !rawHost.endsWith('.exp.direct')) {
    return `http://${rawHost}:${API_PORT}/api/v1`;
  }

  return `http://192.168.110.103:${API_PORT}/api/v1`;
}

const explicitUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

// TODO: ganti dengan domain produksi yang sebenarnya (juga di eas.json).
const PROD_API_URL = 'https://loginrek.example.com/api/v1';

export const env = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
  apiUrl: explicitUrl || (__DEV__ ? devApiUrl() : PROD_API_URL),
  requestTimeoutMs: 15000,
} as const;
