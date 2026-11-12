import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { authApi, setAccessToken, ApiError } from '@/lib/api';
import { userStore, UserAccount } from '@/lib/user-store';
import { tokenStorage } from '@/lib/token-storage';
// userStore imported above
import { colors } from '@/theme/colors';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cegah tombol back Android kembali ke halaman Home atau sesi sebelumnya
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      setErrorMessage('Silakan isi email dan kata sandi kamu');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Kata sandi hanya diverifikasi server. Tidak ada login lokal/offline: sesi berikutnya
      // memakai JWT yang tersimpan (lihat app/index.tsx), jadi login hanya perlu online sekali.
      setAccessToken(null);
      const res = await authApi.login(identifier.trim(), password);
      const token = res.data.token;
      const apiUser = res.data.user;

      await tokenStorage.set(token);
      setAccessToken(token);

      // Cache profil user aktif agar terbaca di Home dan Profile screen
      const userAccount: UserAccount = {
        id: `usr-${apiUser.id}`,
        email: apiUser.email,
        fullName: apiUser.fullName ?? 'Karyawan',
        role: apiUser.role ?? 'Karyawan',
        onTimeCount: 0,
        lateCount: 0,
        todayCheckIn: null,
        history: [],
        avatarUrl: apiUser.avatarUrl ?? undefined,
      };
      await userStore.setCurrentUser(userAccount);

      router.replace('/(app)/home');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(
          err.status === 400 || err.status === 401
            ? err.errors?.[0]?.message || 'Email atau kata sandi salah.'
            : 'Terjadi kesalahan pada server. Coba lagi beberapa saat.',
        );
      } else {
        setErrorMessage('Tidak dapat terhubung ke server. Login pertama wajib online.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* Header Gradien Hijau/Teal */}
      <LinearGradient
        colors={['#033F39', '#06574F', '#0B7369']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 28 }]}
      >
        {/* Logo SapaKerja */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Image
              source={require('@/assets/logo-symbol.png')}
              style={styles.logoImage}
              accessibilityLabel="Logo SapaKerja"
            />
          </View>
          <Text style={styles.brandTitle}>SapaKerja</Text>
          <Text style={styles.brandSubtitle}>Simpan akunmu dengan mudah</Text>
        </View>
      </LinearGradient>

      {/* Card Form Putih di Bawah */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.cardContainer}
      >
        <ScrollView
          contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Judul Form */}
          <Text style={styles.formTitle}>Masuk</Text>
          <Text style={styles.formSubtitle}>Silakan masuk dengan akun karyawan kamu</Text>

          {/* Banner Error jika ada */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Input Email / No. HP */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email atau No. HP</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="nama@perusahaan.com"
                placeholderTextColor="#94A3B8"
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Input Password */}
          <View style={[styles.inputGroup, { marginTop: 18 }]}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Masukkan password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={12}
                style={styles.eyeButton}
              >
                <Feather
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color="#94A3B8"
                />
              </Pressable>
            </View>
          </View>

          {/* Tombol Masuk */}
          <Pressable
            accessibilityRole="button"
            onPress={handleLogin}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              isLoading && styles.submitButtonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Masuk</Text>
                <Feather name="arrow-right" size={20} color="#FFFFFF" style={styles.arrowIcon} />
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#033F39',
  },
  headerGradient: {
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  brandTitle: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F1F24',
    letterSpacing: -0.2,
  },
  formSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginTop: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0F1F24',
  },
  eyeButton: {
    padding: 6,
  },
  submitButton: {
    marginTop: 32,
    height: 54,
    backgroundColor: '#045850',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#045850',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonPressed: {
    backgroundColor: '#033F39',
    transform: [{ scale: 0.99 }],
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  arrowIcon: {
    marginLeft: 8,
  },
});
