/* eslint-env jest */
jest.setTimeout(30000);

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Feather: (props) => React.createElement(Text, props, props.name),
    MaterialCommunityIcons: (props) => React.createElement(Text, props, props.name),
    Ionicons: (props) => React.createElement(Text, props, props.name),
  };
});

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Camera: {
      getCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
      requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    },
    CameraView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: jest.fn().mockResolvedValue({ uri: 'mock-photo-uri' }),
      }));
      return React.createElement(View, props, props.children);
    }),
  };
});

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 1.1059257, longitude: 104.0753418, accuracy: 5 },
  }),
  Accuracy: { Balanced: 3, High: 4, Lowest: 1, Low: 2, Highest: 5 },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://mock-avatar.jpg' }],
  }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'cellular',
  }),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('expo-secure-store', () => {
  const memoryStore = new Map();
  return {
    getItemAsync: jest.fn(async (key) => memoryStore.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      memoryStore.set(key, String(value));
    }),
    deleteItemAsync: jest.fn(async (key) => {
      memoryStore.delete(key);
    }),
  };
});

