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

// Fallback URL backend server lokal (port 3333)
const DEFAULT_LAN_API_URL = 'http://192.168.110.103:3333/api/v1';

export const env = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'preview'),
  apiUrl: explicitUrl || devApiUrl() || DEFAULT_LAN_API_URL,
  requestTimeoutMs: 15000,
} as const;

/**
 * Ubah path media relatif (misal '/uploads/avatars/...') menjadi URL HTTP lengkap
 * agar dapat di-load oleh React Native Image di HP fisik maupun web.
 */
export function getMediaUrl(mediaPath?: string | null): string | null {
  if (!mediaPath) return null;
  if (
    mediaPath.startsWith('http://') ||
    mediaPath.startsWith('https://') ||
    mediaPath.startsWith('data:') ||
    mediaPath.startsWith('file://')
  ) {
    return mediaPath;
  }
  const base = env.apiUrl.replace(/\/api\/v1\/?$/, '');
  const cleanPath = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
  return `${base}${cleanPath}`;
}
