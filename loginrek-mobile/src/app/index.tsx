import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';

import { setAccessToken } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { userStore } from '@/lib/user-store';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const token = await tokenStorage.get();
        const user = await userStore.getCurrentUser();
        // Hanya auto-login jika sudah ada sesi token login resmi (bukan token demo otomatis)
        if (token && user && token !== 'token-auto-demo') {
          setAccessToken(token);
          setHasSession(true);
        } else {
          setHasSession(false);
        }
      } catch {
        setHasSession(false);
      } finally {
        setReady(true);
      }
    }

    checkSession();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  // Jika belum login, arahkan ke Halaman Login!
  return hasSession ? <Redirect href="/home" /> : <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#033F39',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
