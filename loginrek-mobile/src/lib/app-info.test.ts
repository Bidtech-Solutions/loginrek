import { buildAppInfo, RawAppInfo } from './app-info';

jest.mock('expo-updates', () => ({
  isEmbeddedLaunch: true,
  updateId: null,
  manifest: {},
}));

const base: RawAppInfo = {
  appEnv: 'production',
  nativeVersion: '1.0.2',
  nativeBuild: '3',
  configVersion: '1.0.2',
  isEmbeddedLaunch: false,
  updateId: '3f9a1c2e-0000-4000-8000-000000000000',
  publishId: '20261113T041500Z-57a5cf1',
};

describe('buildAppInfo', () => {
  it('menampilkan publishId untuk update OTA', () => {
    expect(buildAppInfo(base)).toEqual({
      environment: 'Production',
      versionLine: 'v1.0.2 Build (3)',
      ota: '20261113T041500Z-57a5cf1',
    });
  });

  it('menampilkan "Bawaan build" bila masih memakai bundle bawaan', () => {
    expect(buildAppInfo({ ...base, isEmbeddedLaunch: true }).ota).toBe('Bawaan build');
  });

  it('fallback ke 8 karakter updateId bila publishId tidak ada di manifest', () => {
    expect(buildAppInfo({ ...base, publishId: null }).ota).toBe('3f9a1c2e');
  });

  it('fallback versi ke config dan melewatkan build yang tidak diketahui', () => {
    const info = buildAppInfo({ ...base, nativeVersion: null, nativeBuild: null });
    expect(info.versionLine).toBe('v1.0.2');
  });

  it('memakai "-" bila versi dan build sama-sama tidak diketahui', () => {
    const info = buildAppInfo({
      ...base,
      nativeVersion: null,
      nativeBuild: null,
      configVersion: null,
    });
    expect(info.versionLine).toBe('-');
  });

  it('mengkapitalkan nama lingkungan', () => {
    expect(buildAppInfo({ ...base, appEnv: 'preview' }).environment).toBe('Preview');
  });
});
