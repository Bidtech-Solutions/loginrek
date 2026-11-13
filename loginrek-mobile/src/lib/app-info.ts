import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { env } from '@/config/env';

export type AppInfo = {
  /** Production / Preview / Development */
  environment: string;
  /** Contoh: "v1.0.2 Build (3)" */
  versionLine: string;
  /** publishId rilis OTA (mis. 20261113T041500Z-57a5cf1), atau "Bawaan build" bila belum ada update OTA. */
  ota: string;
};

export type RawAppInfo = {
  appEnv: string;
  nativeVersion: string | null;
  nativeBuild: string | null;
  configVersion: string | null;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  publishId: string | null;
};

const EMBEDDED_LABEL = 'Bawaan build';

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Fungsi murni: susun teks dari nilai mentah (mudah diuji tanpa modul native). */
export function buildAppInfo(raw: RawAppInfo): AppInfo {
  const version = raw.nativeVersion ?? raw.configVersion;
  const parts = [
    version ? `v${version}` : null,
    raw.nativeBuild ? `Build (${raw.nativeBuild})` : null,
  ];

  let ota = EMBEDDED_LABEL;
  if (!raw.isEmbeddedLaunch) {
    ota = raw.publishId ?? (raw.updateId ? raw.updateId.slice(0, 8) : EMBEDDED_LABEL);
  }

  return {
    environment: capitalize(raw.appEnv),
    versionLine: parts.filter(Boolean).join(' ') || '-',
    ota,
  };
}

/**
 * expo-application butuh modul native; pada binary lama yang dibuat tanpa modul itu,
 * `require` melempar error. Jangan sampai layar Profil ikut crash.
 */
function readApplication(): { version: string | null; build: string | null } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Application = require('expo-application') as typeof import('expo-application');
    return { version: Application.nativeApplicationVersion, build: Application.nativeBuildVersion };
  } catch {
    return { version: null, build: null };
  }
}

function readPublishId(): string | null {
  // CI menaruh publishId di manifest.metadata (lihat .github/workflows/loginrek.yml).
  const metadata = (Updates.manifest as { metadata?: Record<string, unknown> } | undefined)
    ?.metadata;
  const value = metadata?.publishId;
  return typeof value === 'string' && value ? value : null;
}

export function getAppInfo(): AppInfo {
  const app = readApplication();
  return buildAppInfo({
    appEnv: env.appEnv,
    nativeVersion: app.version,
    nativeBuild: app.build,
    configVersion: Constants.expoConfig?.version ?? null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    publishId: readPublishId(),
  });
}
