import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AttendanceRecord {
  id: string;
  day: string;
  time: string;
  status: 'Tepat Waktu' | 'Terlambat';
  photoUri?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: string;
  onTimeCount: number;
  lateCount: number;
  todayCheckIn: { date?: string; time: string; isLate: boolean; photoUri?: string } | null;
  history: AttendanceRecord[];
  avatarUrl?: string;
}

const USER_STORAGE_KEY = 'loginrek.currentUser';

/**
 * Cache sesi user di perangkat (profil + rekap absen). BUKAN sumber autentikasi:
 * identitas & kata sandi hanya diverifikasi server (POST /auth/login); di sini tidak
 * ada daftar akun maupun kata sandi.
 */
export const userStore = {
  // Ambil user yang sedang aktif login; null bila belum login
  getCurrentUser: async (): Promise<UserAccount | null> => {
    try {
      const raw =
        Platform.OS === 'web'
          ? typeof window !== 'undefined'
            ? window.localStorage.getItem(USER_STORAGE_KEY)
            : null
          : await SecureStore.getItemAsync(USER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UserAccount) : null;
    } catch {
      return null;
    }
  },

  // Simpan/update data user aktif
  setCurrentUser: async (user: UserAccount): Promise<void> => {
    const serialized = JSON.stringify(user);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(USER_STORAGE_KEY, serialized);
      }
      return;
    }
    await SecureStore.setItemAsync(USER_STORAGE_KEY, serialized);
  },

  // Catat presensi hari ini dan update rekap bulanan secara otomatis
  recordAttendance: async (
    timeFormatted: string,
    isLate: boolean,
    photoUri?: string,
  ): Promise<UserAccount | null> => {
    const user = await userStore.getCurrentUser();
    if (!user) return null;

    const status: 'Tepat Waktu' | 'Terlambat' = isLate ? 'Terlambat' : 'Tepat Waktu';
    const now = new Date();
    const dateNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dayName = dateNames[now.getDay()];
    const dateNum = now.getDate();
    const monthName = monthNames[now.getMonth()];
    const year = now.getFullYear();

    const newRecord: AttendanceRecord = {
      id: String(Date.now()),
      day: `Hari ini, ${dayName} ${dateNum} ${monthName} ${year}`,
      time: `Jam Masuk: ${timeFormatted} WIB`,
      status,
      photoUri: photoUri && photoUri !== 'fallback' ? photoUri : undefined,
    };

    const updatedUser: UserAccount = {
      ...user,
      todayCheckIn: { date: new Date().toISOString().slice(0, 10), time: timeFormatted, isLate, photoUri },
      onTimeCount: !isLate ? user.onTimeCount + 1 : user.onTimeCount,
      lateCount: isLate ? user.lateCount + 1 : user.lateCount,
      history: [newRecord, ...user.history.slice(0, 4)],
    };

    await userStore.setCurrentUser(updatedUser);
    return updatedUser;
  },

  // Update foto profil akun aktif
  updateAvatar: async (avatarUri: string): Promise<UserAccount | null> => {
    const user = await userStore.getCurrentUser();
    if (!user) return null;

    const updatedUser: UserAccount = {
      ...user,
      avatarUrl: avatarUri,
    };

    await userStore.setCurrentUser(updatedUser);
    return updatedUser;
  },

  // Hapus data session user
  clearCurrentUser: async (): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_STORAGE_KEY);
      }
      return;
    }
    await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
  },
};
