import { syncStore } from '@/lib/sync-store';
import { attendanceApi } from '@/lib/api';
import NetInfo from '@react-native-community/netinfo';

describe('syncStore (Offline Attendance & Auto-Sync)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(attendanceApi, 'checkIn').mockResolvedValue({
      data: {
        message: 'Presensi berhasil dicatat',
        attendance: {
          id: 1,
          userId: 2,
          date: '2026-10-28',
          clockInTime: '07:55:00 WIB',
          status: 'Tepat Waktu',
          isLate: false,
          photoPath: null,
          latitude: 1.105925,
          longitude: 104.075342,
          distanceMeters: 5,
          officeName: 'Kantor Piposmart',
          isOfflineSync: true,
          createdAt: new Date().toISOString(),
        },
      },
    });
  });

  test('mengecek status koneksi internet', async () => {
    const isOnline = await syncStore.isOnline();
    expect(isOnline).toBe(true);
  });

  test('menyimpan presensi ke antrean offline dan menghitung antrean', async () => {
    const item = await syncStore.addToQueue({
      email: 'timmy@gmail.com',
      capturedTime: '07.55',
      isLate: false,
      latitude: 1.1059257,
      longitude: 104.0753418,
    });

    expect(item.id).toMatch(/^queue-/);
    expect(item.syncStatus).toBe('pending');

    const count = await syncStore.getPendingCount();
    expect(count).toBeGreaterThanOrEqual(1);

    const queue = await syncStore.getQueue();
    expect(queue.some((q) => q.id === item.id)).toBe(true);
  });

  test('menyinkronkan antrean presensi saat online', async () => {
    const res = await syncStore.syncPending();
    expect(res.remainingCount).toBe(0);

    const countAfter = await syncStore.getPendingCount();
    expect(countAfter).toBe(0);
  });
});
