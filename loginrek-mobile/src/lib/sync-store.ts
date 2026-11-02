import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { attendanceApi } from '@/lib/api';

export interface PendingAttendance {
  id: string;
  email: string;
  capturedTime: string;
  isLate: boolean;
  photoUri?: string;
  latitude: number;
  longitude: number;
  recordedAt: number; // Timestamp epoch saat foto diambil
  syncStatus: 'pending' | 'synced';
}

const SYNC_QUEUE_KEY = 'loginrek.syncQueue';

export const syncStore = {
  // Cek apakah perangkat terhubung ke internet (baik via WiFi maupun Paket Data Seluler 4G/5G)
  isOnline: async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        return typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
      }
      const state = await NetInfo.fetch();
      // Perangkat dianggap online jika terhubung dan internet reachable
      return Boolean(state.isConnected && (state.isInternetReachable ?? true));
    } catch {
      return true;
    }
  },

  // Pantau perubahan status koneksi (online <-> offline) secara realtime
  subscribeNetworkState: (onChange: (isOnline: boolean) => void) => {
    if (Platform.OS === 'web') {
      const handleOnline = () => onChange(true);
      const handleOffline = () => onChange(false);
      if (typeof window !== 'undefined') {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
      }
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        }
      };
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      onChange(online);
    });
    return unsubscribe;
  },

  // Ambil daftar antrean presensi offline yang belum terkirim ke server
  getQueue: async (): Promise<PendingAttendance[]> => {
    try {
      if (Platform.OS === 'web') {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SYNC_QUEUE_KEY) : null;
        return raw ? (JSON.parse(raw) as PendingAttendance[]) : [];
      }
      const raw = await SecureStore.getItemAsync(SYNC_QUEUE_KEY);
      return raw ? (JSON.parse(raw) as PendingAttendance[]) : [];
    } catch {
      return [];
    }
  },

  // Simpan data presensi offline ke memori lokal HP (SecureStore)
  addToQueue: async (
    item: Omit<PendingAttendance, 'id' | 'recordedAt' | 'syncStatus'>
  ): Promise<PendingAttendance> => {
    const queue = await syncStore.getQueue();
    const newItem: PendingAttendance = {
      ...item,
      id: `queue-${Date.now()}`,
      recordedAt: Date.now(),
      syncStatus: 'pending',
    };
    const updated = [newItem, ...queue];
    const serialized = JSON.stringify(updated);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SYNC_QUEUE_KEY, serialized);
      }
    } else {
      await SecureStore.setItemAsync(SYNC_QUEUE_KEY, serialized);
    }
    return newItem;
  },

  // Sinkronkan antrean ke server saat koneksi internet kembali aktif
  syncPending: async (): Promise<{ syncedCount: number; remainingCount: number }> => {
    const online = await syncStore.isOnline();
    if (!online) {
      const queue = await syncStore.getQueue();
      return { syncedCount: 0, remainingCount: queue.length };
    }

    const queue = await syncStore.getQueue();
    if (queue.length === 0) {
      return { syncedCount: 0, remainingCount: 0 };
    }

    // Pengiriman data ke server API
    let syncedCount = 0;
    const remaining: PendingAttendance[] = [];

    for (const item of queue) {
      try {
        await attendanceApi.checkIn({
          clockInTime: `${item.capturedTime} WIB`,
          isLate: item.isLate,
          photo: item.photoUri,
          latitude: item.latitude,
          longitude: item.longitude,
          isOfflineSync: true,
        });
        syncedCount++;
      } catch {
        // Jika gagal kirim (misal offline kembali / duplikat), evaluasi
        remaining.push(item);
      }
    }

    // Bersihkan antrean atau simpan sisa yang belum berhasil
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
      }
    } else {
      await SecureStore.setItemAsync(SYNC_QUEUE_KEY, JSON.stringify(remaining));
    }

    return { syncedCount, remainingCount: remaining.length };
  },

  // Hitung jumlah antrean yang belum tersinkronkan
  getPendingCount: async (): Promise<number> => {
    const queue = await syncStore.getQueue();
    return queue.length;
  },
};
