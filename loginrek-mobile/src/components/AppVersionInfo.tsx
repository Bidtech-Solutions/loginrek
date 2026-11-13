import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getAppInfo } from '@/lib/app-info';
import { colors, spacing } from '@/theme/colors';

/** Info lingkungan, versi, build, dan rilis OTA yang sedang berjalan. */
export function AppVersionInfo() {
  const info = useMemo(() => getAppInfo(), []);

  return (
    <View style={styles.container} accessibilityLabel="Informasi versi aplikasi">
      <Text style={styles.environment}>{info.environment}</Text>
      <Text style={styles.line}>{info.versionLine}</Text>
      <Text style={styles.line} selectable>
        {info.ota}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: 2,
  },
  environment: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  line: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
