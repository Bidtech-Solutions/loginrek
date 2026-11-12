import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useObserve } from 'expo-observe';
import { Redirect } from 'expo-router';

import { setAccessToken } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { userStore } from '@/lib/user-store';

type Target = '/(app)/home' | '/(auth)/login' | null;

export default function Index() {
  const [target, setTarget] = useState<Target>(null);
  const { markInteractive } = useObserve();

  // Pulihkan sesi dari JWT yang tersimpan di SecureStore, sehingga HP yang sedang offline
  // tetap bisa membuka aplikasi dan menyimpan absen ke antrean (disinkronkan saat online).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, user] = await Promise.all([tokenStorage.get(), userStore.getCurrentUser()]);
      if (cancelled) return;
      if (token && user) {
        setAccessToken(token);
        setTarget('/(app)/home');
      } else {
        setAccessToken(null);
        setTarget('/(auth)/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sesi sudah dipulihkan dan tujuan awal (home/login) sudah ditentukan: aplikasi siap dipakai.
  useEffect(() => {
    if (target) markInteractive();
  }, [target, markInteractive]);

  return <View style={styles.container}>{target && <Redirect href={target} />}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#033F39',
  },
});
