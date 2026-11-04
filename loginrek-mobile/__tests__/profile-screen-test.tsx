import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProfileScreen from '@/app/(app)/profile';
import { userStore } from '@/lib/user-store';

jest.mock('@/lib/api', () => ({
  authApi: {
    updateProfile: jest.fn(async () => ({ user: { avatarUrl: 'file://mock-avatar.jpg' } })),
  },
  ApiError: class extends Error {},
  setAccessToken: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (callback: any) => callback(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file://mock-avatar.jpg', base64: 'mockbase64' }],
  })),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('<ProfileScreen />', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await userStore.setCurrentUser({
      id: 'usr-budi-03',
      email: 'budi@gmail.com',
      passwords: ['password123'],
      fullName: 'Budi Santoso',
      role: 'Software Engineer',
      onTimeCount: 0,
      lateCount: 0,
      todayCheckIn: null,
      history: [],
    });
  });

  test('menampilkan judul Edit Profil, tombol Ubah Foto, dan tombol Simpan Perubahan di bagian bawah', async () => {
    const { getByText, getByLabelText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProfileScreen />
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(getByText('Edit Profil')).toBeTruthy();
      expect(getByText('Ubah Foto')).toBeTruthy();
      expect(getByLabelText('Ubah foto profil')).toBeTruthy();
      expect(getByText('Simpan Perubahan')).toBeTruthy();
    });
  });
});
