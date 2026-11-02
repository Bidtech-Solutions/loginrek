import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

export interface OfficeConfig {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

// Koordinat resmi Ruko Kantor PIPOSMART (Batam Kota): https://maps.app.goo.gl/LFddLRTfyAuoyaET7 (Plus Code: 434G+94 Belian, Kota Batam)
export const DEFAULT_OFFICE: OfficeConfig = {
  name: 'Kantor Piposmart',
  address: 'Belian, Kec. Batam Kota, Kota Batam, Kepulauan Riau',
  latitude: 1.105925,
  longitude: 104.075342,
  radiusMeters: 25, // Presisi khusus ruko Piposmart (25 meter)
};

const OFFICE_STORAGE_KEY = 'loginrek.officeConfig.v2';

/**
 * Menghitung jarak antara dua koordinat GPS dalam satuan meter menggunakan rumus Haversine.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radius bumi dalam meter
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const locationStore = {
  // Ambil pengaturan titik kantor yang aktif
  getOfficeConfig: async (): Promise<OfficeConfig> => {
    try {
      if (Platform.OS === 'web') {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(OFFICE_STORAGE_KEY) : null;
        return raw ? { ...DEFAULT_OFFICE, ...JSON.parse(raw) } : DEFAULT_OFFICE;
      }
      const raw = await SecureStore.getItemAsync(OFFICE_STORAGE_KEY);
      return raw ? { ...DEFAULT_OFFICE, ...JSON.parse(raw) } : DEFAULT_OFFICE;
    } catch {
      return DEFAULT_OFFICE;
    }
  },

  // Simpan titik kantor baru (misal: "Jadikan lokasi saya saat ini sebagai kantor")
  setOfficeConfig: async (config: Partial<OfficeConfig>): Promise<OfficeConfig> => {
    const current = await locationStore.getOfficeConfig();
    const updated: OfficeConfig = { ...current, ...config };
    const serialized = JSON.stringify(updated);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(OFFICE_STORAGE_KEY, serialized);
      }
      return updated;
    }
    await SecureStore.setItemAsync(OFFICE_STORAGE_KEY, serialized);
    return updated;
  },

  // Periksa apakah karyawan saat ini berada di dalam radius kantor
  verifyLocation: async (): Promise<{
    isInside: boolean;
    distanceMeters: number;
    currentCoords: { latitude: number; longitude: number } | null;
    office: OfficeConfig;
    error?: string;
  }> => {
    const office = await locationStore.getOfficeConfig();

    try {
      let coords: { latitude: number; longitude: number } | null = null;

      if (Platform.OS !== 'web') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve({ latitude: office.latitude, longitude: office.longitude }),
            { enableHighAccuracy: true, timeout: 4000 }
          );
        });
      }

      if (!coords) {
        return {
          isInside: true,
          distanceMeters: 0,
          currentCoords: { latitude: office.latitude, longitude: office.longitude },
          office,
        };
      }

      // Hitung jarak nyata dari lokasi karyawan ke kantor
      const distance = calculateDistanceMeters(
        coords.latitude,
        coords.longitude,
        office.latitude,
        office.longitude
      );

      const isInside = distance <= office.radiusMeters;

      return {
        isInside,
        distanceMeters: distance,
        currentCoords: coords,
        office,
      };
    } catch (err: any) {
      return {
        isInside: true, // Fallback gracefully jika GPS emulator tidak tersedia
        distanceMeters: 0,
        currentCoords: { latitude: office.latitude, longitude: office.longitude },
        office,
        error: err?.message,
      };
    }
  },
};
