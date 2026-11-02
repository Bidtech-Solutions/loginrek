import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';

import { setAccessToken } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { userStore, UserAccount } from '@/lib/user-store';

export default function Index() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function initSession() {
      try {
        const token = (await tokenStorage.get()) || 'token-auto-demo';
        await tokenStorage.set(token);
        setAccessToken(token);

        // Pastikan ada user aktif agar langsung bisa dipakai presensi
        const existingUser = await userStore.getCurrentUser();
        if (!existingUser || existingUser.email === 'timmy@gmail.com') {
          const defaultUser: UserAccount = {
            id: 'usr-10',
            email: 'wicaksono@loginrek.com',
            passwords: ['123456'],
            fullName: 'Wicaksono',
            role: 'HRD',
            onTimeCount: 0,
            lateCount: 0,
            todayCheckIn: null,
            history: [],
          };
          await userStore.setCurrentUser(defaultUser);
        }
      } finally {
        setReady(true);
      }
    }

    initSession();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  // Langsung masuk ke Beranda tanpa perlu ketik login!
  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#033F39',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
