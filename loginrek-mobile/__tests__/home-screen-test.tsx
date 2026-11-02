import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Index from '@/app/index';

jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
  router: { replace: jest.fn() },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('<Index />', () => {
  test('merender alur inisialisasi auth', async () => {
    const { toJSON } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Index />
      </SafeAreaProvider>,
    );

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });
});
