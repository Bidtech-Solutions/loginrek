import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AttendanceScreen from '@/app/(app)/attendance';
import { permissionStore } from '@/lib/permission-store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('<AttendanceScreen />', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await permissionStore.resetPermissions();
  });

  test('tahap 1: menampilkan permohonan izin kamera ketika belum diizinkan', async () => {
    const { getByText, queryByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AttendanceScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Kamera belum diizinkan')).toBeTruthy();
      expect(getByText('Panduan Singkat')).toBeTruthy();
      expect(getByText('Aktifkan akses Kamera')).toBeTruthy();
      // Pastikan demo tabs dan GPS tag tidak ada
      expect(queryByText('Kamera Aktif')).toBeNull();
      expect(queryByText('Kantor Pusat Bidtech (Dalam Radius 12m)')).toBeNull();
    });
  });

  test('tahap 2: setelah izin kamera diberikan, beralih ke permohonan izin lokasi (GPS)', async () => {
    const { getByText, getByLabelText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AttendanceScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Kamera belum diizinkan')).toBeTruthy();
    });

    const bukaPengaturanBtn = getByLabelText('Buka Pengaturan Kamera');
    await act(async () => {
      fireEvent.press(bukaPengaturanBtn);
    });

    await waitFor(() => {
      expect(getByText('Lokasi belum aktif')).toBeTruthy();
      expect(getByText('Panduan Cepat')).toBeTruthy();
      expect(getByText('3 LANGKAH')).toBeTruthy();
    });
  });

  test('tahap 3: setelah izin lokasi juga diberikan, kamera viewfinder aktif siap presensi', async () => {
    const { getByText, getByLabelText, queryByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AttendanceScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Kamera belum diizinkan')).toBeTruthy();
    });

    // Beri izin kamera
    await act(async () => {
      fireEvent.press(getByLabelText('Buka Pengaturan Kamera'));
    });

    await waitFor(() => {
      expect(getByText('Lokasi belum aktif')).toBeTruthy();
    });

    // Beri izin lokasi
    await act(async () => {
      fireEvent.press(getByLabelText('Buka Pengaturan Lokasi'));
    });

    await waitFor(() => {
      expect(
        getByText('Pastikan pencahayaan cukup dan wajah terlihat jelas')
      ).toBeTruthy();
      expect(getByText('Presensi')).toBeTruthy();
      // Pastikan tidak ada tag GPS dan tidak ada tabs
      expect(queryByText('Kantor Pusat Bidtech (Dalam Radius 12m)')).toBeNull();
      expect(queryByText('Kamera Aktif')).toBeNull();
    });
  });

  test('tahap 4: menjepret foto menampilkan preview konfirmasi dengan waktu tercatat dan tombol Foto Ulang & Kirim Presensi', async () => {
    const { getByText, getByLabelText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AttendanceScreen />
      </SafeAreaProvider>
    );

    // Beri izin kamera & lokasi
    await act(async () => {
      fireEvent.press(getByLabelText('Buka Pengaturan Kamera'));
    });
    await act(async () => {
      fireEvent.press(getByLabelText('Buka Pengaturan Lokasi'));
    });

    // Tekan tombol presensi untuk menjepret foto
    await act(async () => {
      fireEvent.press(getByLabelText('Tombol Presensi'));
    });

    // Menampilkan halaman konfirmasi preview foto (1:1 sesuai mockup)
    await waitFor(() => {
      expect(getByText('WAKTU ABSEN TERCATAT')).toBeTruthy();
      expect(getByText('WIB')).toBeTruthy();
      expect(getByText('STATUS KEHADIRAN')).toBeTruthy();
      expect(getByText('Foto Ulang')).toBeTruthy();
      expect(getByText('Kirim Presensi')).toBeTruthy();
    });

    // Uji tombol "Foto Ulang"
    await act(async () => {
      fireEvent.press(getByLabelText('Foto Ulang'));
    });

    // Harus kembali ke viewfinder kamera
    await waitFor(() => {
      expect(
        getByText('Pastikan pencahayaan cukup dan wajah terlihat jelas')
      ).toBeTruthy();
    });
  });
});

