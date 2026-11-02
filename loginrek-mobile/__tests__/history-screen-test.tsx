import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import HistoryScreen from '@/app/(app)/history';
import { userStore } from '@/lib/user-store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (cb: any) => cb(),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('<HistoryScreen />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('merender halaman riwayat dengan default bulan Oktober 2026 dan clean empty state', async () => {
    const { getByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <HistoryScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Oktober 2026')).toBeTruthy();
      expect(getByText('Belum ada absensi bulan ini.')).toBeTruthy();
      expect(getByText('Hadir')).toBeTruthy();
    });
  });

  test('navigasi bulan ke November 2026 menampilkan empty state', async () => {
    const { getByText, getByLabelText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <HistoryScreen />
      </SafeAreaProvider>
    );

    const nextBtn = getByLabelText('Bulan berikutnya');
    fireEvent.press(nextBtn);

    await waitFor(() => {
      expect(getByText('November 2026')).toBeTruthy();
      expect(getByText('Belum ada absensi bulan ini.')).toBeTruthy();
    });
  });

  test('menampilkan tombol Beranda di FAB tengah dan menavigasi ke home', async () => {
    const { getByLabelText, getByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <HistoryScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Beranda')).toBeTruthy();
    });

    const homeBtn = getByLabelText('Kembali ke Beranda');
    fireEvent.press(homeBtn);

    expect(router.replace).toHaveBeenCalledWith('/(app)/home');
  });

  test('menekan pemilih bulan membuka kalender presensi asli dengan grid tanggal dan hari', async () => {
    const { getByLabelText, getByText, getAllByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <HistoryScreen />
      </SafeAreaProvider>
    );

    const openCalendarBtn = getByLabelText('Buka Kalender Presensi');
    fireEvent.press(openCalendarBtn);

    await waitFor(() => {
      expect(getByText('Min')).toBeTruthy();
      expect(getByText('Sen')).toBeTruthy();
      expect(getByText('Sel')).toBeTruthy();
      expect(getByText('Rab')).toBeTruthy();
      expect(getByText('Kam')).toBeTruthy();
      expect(getByText('Jum')).toBeTruthy();
      expect(getByText('Sab')).toBeTruthy();
      expect(getByLabelText('Tanggal 14')).toBeTruthy();
      expect(getAllByText('Tepat Waktu').length).toBeGreaterThan(0);
      expect(getAllByText('Terlambat').length).toBeGreaterThan(0);
      expect(getAllByText('Tidak Hadir').length).toBeGreaterThan(0);
    });
  });

  test('memilih tanggal pada kalender menyaring riwayat dan menutup kalender', async () => {
    jest.spyOn(userStore, 'getCurrentUser').mockResolvedValue({
      id: 'usr-timmy-01',
      email: 'timmy@gmail.com',
      passwords: ['password123'],
      fullName: 'Timmy Kurniawan',
      role: 'Software Engineer',
      onTimeCount: 1,
      lateCount: 0,
      todayCheckIn: { time: '07.48', isLate: false, photoUri: 'file:///photo.jpg' },
      history: [
        {
          id: '1',
          day: 'Rab, 28 Okt 2026',
          time: 'Jam Masuk: 07.48 WIB',
          status: 'Tepat Waktu',
          photoUri: 'file:///photo.jpg',
        },
      ],
    });

    const { getByLabelText, getByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <HistoryScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Rab, 28 Okt 2026')).toBeTruthy();
    });

    const openCalendarBtn = getByLabelText('Buka Kalender Presensi');
    fireEvent.press(openCalendarBtn);

    await waitFor(() => {
      expect(getByLabelText('Tanggal 28')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Tanggal 28'));

    await waitFor(() => {
      expect(getByText(/Filter tanggal:/)).toBeTruthy();
      expect(getByText('1 Riwayat')).toBeTruthy();
      expect(getByText('Rab, 28 Okt 2026')).toBeTruthy();
    });
  });

  test('mengetuk salah satu kartu riwayat membuka detail presensi dan bisa kembali ke riwayat', async () => {
    jest.spyOn(userStore, 'getCurrentUser').mockResolvedValue({
      id: 'usr-timmy-01',
      email: 'timmy@gmail.com',
      passwords: ['password123'],
      fullName: 'Timmy Kurniawan',
      role: 'Software Engineer',
      onTimeCount: 1,
      lateCount: 0,
      todayCheckIn: { time: '07.48', isLate: false, photoUri: 'file:///photo.jpg' },
      history: [
        {
          id: '1',
          day: 'Rab, 28 Okt 2026',
          time: 'Jam Masuk: 07.48 WIB',
          status: 'Tepat Waktu',
          photoUri: 'file:///photo.jpg',
        },
      ],
    });

    const { getByLabelText, getByText, queryByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <HistoryScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Rab, 28 Okt 2026')).toBeTruthy();
    });

    const itemCard = getByLabelText('Detail presensi Rab, 28 Okt 2026');
    fireEvent.press(itemCard);

    await waitFor(() => {
      expect(getByText('WAKTU ABSEN TERCATAT')).toBeTruthy();
      expect(getByText('STATUS KEHADIRAN')).toBeTruthy();
      expect(getByLabelText('Kembali ke Halaman Riwayat')).toBeTruthy();
      // Pastikan lokasi presensi, tombol foto ulang, dan kirim presensi tidak ada
      expect(queryByText('LOKASI PRESENSI')).toBeNull();
      expect(queryByText('Foto Ulang')).toBeNull();
      expect(queryByText('Kirim Presensi')).toBeNull();
    });

    // Uji tombol kembali ke riwayat di header atas
    const backBtn = getByLabelText('Kembali ke Halaman Riwayat');
    fireEvent.press(backBtn);

    await waitFor(() => {
      expect(getByText('Aktivitas Presensi')).toBeTruthy();
    });
  });
});
