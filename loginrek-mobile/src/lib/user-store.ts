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
  passwords: string[];
  fullName: string;
  role: string;
  onTimeCount: number;
  lateCount: number;
  todayCheckIn: { time: string; isLate: boolean; photoUri?: string } | null;
  history: AttendanceRecord[];
  avatarUrl?: string;
}

export const INITIAL_ACCOUNTS: Record<string, UserAccount> = {
  'timmy@gmail.com': {
    id: 'usr-timmy-01',
    email: 'timmy@gmail.com',
    passwords: ['password123', 'timmy123', 'admin123'],
    fullName: 'Timmy Kurniawan',
    role: 'Software Engineer',
    onTimeCount: 0,
    lateCount: 0,
    todayCheckIn: null,
    history: [],
  },
  'satria@gmail.com': {
    id: 'usr-satria-02',
    email: 'satria@gmail.com',
    passwords: ['password123', 'satria123', 'admin123'],
    fullName: 'Satria Pratama',
    role: 'UI/UX Designer',
    onTimeCount: 0,
    lateCount: 0,
    todayCheckIn: null,
    history: [],
  },
  'budi@gmail.com': {
    id: 'usr-budi-03',
    email: 'budi@gmail.com',
    passwords: ['password123', 'budi123', 'admin123'],
    fullName: 'Budi Santoso',
    role: 'Software Engineer',
    onTimeCount: 0,
    lateCount: 0,
    todayCheckIn: null,
    history: [],
  },
  'anisa@gmail.com': {
    id: 'usr-anisa-04',
    email: 'anisa@gmail.com',
    passwords: ['password123', 'anisa123', 'admin123'],
    fullName: 'Anisa Rahmawati',
    role: 'Product Manager',
    onTimeCount: 0,
    lateCount: 0,
    todayCheckIn: null,
    history: [],
  },
  'faisal@gmail.com': {
    id: 'usr-faisal-05',
    email: 'faisal@gmail.com',
    passwords: ['password123', 'faisal123', 'admin123'],
    fullName: 'Faisal Akbar',
    role: 'Mobile Developer',
    onTimeCount: 0,
    lateCount: 0,
    todayCheckIn: null,
    history: [],
  },
};

export type AuthResult =
  | { success: true; user: UserAccount }
  | { success: false; error: string };

const USER_STORAGE_KEY = 'loginrek.currentUser';
const CACHE_VERSION_KEY = 'loginrek.cacheVersion';
const CURRENT_CACHE_VERSION = 'clean_demo_2026_v1';

export const userStore = {
  // Autentikasi email dan password
  authenticate: async (emailInput: string, passwordInput: string): Promise<AuthResult> => {
    const cleanEmail = emailInput.trim().toLowerCase();
    const account = INITIAL_ACCOUNTS[cleanEmail];
    
    // Jika email tidak ditemukan
    if (!account) {
      return {
        success: false,
        error: 'Email tidak terdaftar. Periksa kembali email Anda.',
      };
    }

    // Jika kata sandi tidak cocok
    if (!account.passwords.includes(passwordInput.trim())) {
      return {
        success: false,
        error: 'Kata sandi salah. Silakan coba lagi.',
      };
    }

    // Berhasil login: simpan session user aktif
    await userStore.setCurrentUser(account);
    return { success: true, user: account };
  },

  // Ambil user yang sedang aktif login (otomatis bersihkan jika masih ada cache dummy lama)
  getCurrentUser: async (): Promise<UserAccount | null> => {
    try {
      const getStoredVersion = async () => {
        if (Platform.OS === 'web') {
          return typeof window !== 'undefined' ? window.localStorage.getItem(CACHE_VERSION_KEY) : null;
        }
        return SecureStore.getItemAsync(CACHE_VERSION_KEY);
      };

      const setStoredVersion = async (v: string) => {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') window.localStorage.setItem(CACHE_VERSION_KEY, v);
          return;
        }
        await SecureStore.setItemAsync(CACHE_VERSION_KEY, v);
      };

      const version = await getStoredVersion();
      if (version !== CURRENT_CACHE_VERSION) {
        // Reset cache lama yang masih menyimpan data dummy absensi
        await userStore.clearCurrentUser();
        await setStoredVersion(CURRENT_CACHE_VERSION);
        return INITIAL_ACCOUNTS['timmy@gmail.com'];
      }

      if (Platform.OS === 'web') {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(USER_STORAGE_KEY) : null;
        return raw ? (JSON.parse(raw) as UserAccount) : INITIAL_ACCOUNTS['timmy@gmail.com'];
      }
      const raw = await SecureStore.getItemAsync(USER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UserAccount) : INITIAL_ACCOUNTS['timmy@gmail.com'];
    } catch {
      return INITIAL_ACCOUNTS['timmy@gmail.com'];
    }
  },

  // Reset total data absensi untuk persiapan demo bersih
  resetAllAttendanceData: async (): Promise<void> => {
    await userStore.clearCurrentUser();
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
      }
    } else {
      await SecureStore.setItemAsync(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
    }
    await userStore.setCurrentUser(INITIAL_ACCOUNTS['timmy@gmail.com']);
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
      todayCheckIn: { time: timeFormatted, isLate, photoUri },
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

    if (INITIAL_ACCOUNTS[user.email.toLowerCase()]) {
      INITIAL_ACCOUNTS[user.email.toLowerCase()].avatarUrl = avatarUri;
    }

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
