import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import ProfileScreen from '@/app/(app)/profile';
import { userStore } from '@/lib/user-store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('<ProfileScreen />', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  test('menampilkan judul Edit Profil dan tombol Ubah Foto', async () => {
    const { getByText, getByLabelText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProfileScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Edit Profil')).toBeTruthy();
      expect(getByText('Ubah Foto')).toBeTruthy();
      expect(getByLabelText('Ubah foto profil')).toBeTruthy();
    });
  });

  test('menekan Ubah Foto memicu permintaan izin galeri foto dan update foto profil', async () => {
    const { getByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProfileScreen />
      </SafeAreaProvider>
    );

    const ubahFotoBtn = getByText('Ubah Foto');
    await act(async () => {
      fireEvent.press(ubahFotoBtn);
    });

    await waitFor(() => {
      expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
  });
});
