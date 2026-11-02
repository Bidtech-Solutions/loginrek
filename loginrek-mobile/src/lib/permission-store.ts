import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CAMERA_PERMISSION_KEY = 'loginrek.permission.camera';
const LOCATION_PERMISSION_KEY = 'loginrek.permission.location';

// Status izin dalam memori runtime (dimulai dari false untuk demo flow izin)
let memoryCameraGranted = false;
let memoryLocationGranted = false;

export const permissionStore = {
  // Cek apakah izin kamera sudah diberikan
  getCameraPermission: async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          const stored = window.sessionStorage.getItem(CAMERA_PERMISSION_KEY);
          if (stored !== null) return stored === 'true';
        }
        return memoryCameraGranted;
      }
      const stored = await SecureStore.getItemAsync(CAMERA_PERMISSION_KEY);
      return stored === 'true';
    } catch {
      return memoryCameraGranted;
    }
  },

  // Simpan status izin kamera
  setCameraPermission: async (granted: boolean): Promise<void> => {
    memoryCameraGranted = granted;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CAMERA_PERMISSION_KEY, String(granted));
        }
      } else {
        await SecureStore.setItemAsync(CAMERA_PERMISSION_KEY, String(granted));
      }
    } catch {
      // Abaikan error storage
    }
  },

  // Cek apakah izin lokasi sudah diberikan
  getLocationPermission: async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          const stored = window.sessionStorage.getItem(LOCATION_PERMISSION_KEY);
          if (stored !== null) return stored === 'true';
        }
        return memoryLocationGranted;
      }
      const stored = await SecureStore.getItemAsync(LOCATION_PERMISSION_KEY);
      return stored === 'true';
    } catch {
      return memoryLocationGranted;
    }
  },

  // Simpan status izin lokasi
  setLocationPermission: async (granted: boolean): Promise<void> => {
    memoryLocationGranted = granted;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(LOCATION_PERMISSION_KEY, String(granted));
        }
      } else {
        await SecureStore.setItemAsync(LOCATION_PERMISSION_KEY, String(granted));
      }
    } catch {
      // Abaikan error storage
    }
  },

  // Reset semua izin kembali ke belum aktif (untuk demo alur perizinan)
  resetPermissions: async (): Promise<void> => {
    memoryCameraGranted = false;
    memoryLocationGranted = false;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(CAMERA_PERMISSION_KEY);
          window.sessionStorage.removeItem(LOCATION_PERMISSION_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(CAMERA_PERMISSION_KEY);
        await SecureStore.deleteItemAsync(LOCATION_PERMISSION_KEY);
      }
    } catch {
      // Abaikan error storage
    }
  },
};
