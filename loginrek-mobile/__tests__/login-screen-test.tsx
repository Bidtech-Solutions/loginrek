import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from '@/app/(auth)/login';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('<LoginScreen />', () => {
  test('menampilkan judul Login Rek dan form masuk', async () => {
    const { getByText, getAllByText, getByPlaceholderText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <LoginScreen />
      </SafeAreaProvider>,
    );

    getByText('Login Rek');
    getByText('Simpan akunmu dengan mudah');
    expect(getAllByText('Masuk').length).toBe(2);
    getByText('Silakan masuk dengan akun karyawan kamu');
    getByPlaceholderText('nama@perusahaan.com');
    getByPlaceholderText('Masukkan password');
  });
});
