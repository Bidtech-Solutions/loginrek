import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

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

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      setErrorMessage('Silakan isi email dan kata sandi kamu');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      // 1. Coba login ke API backend REST (AdonisJS)
      try {
        const res = await authApi.login(identifier.trim(), password);
        const token = res.data.token;
        const apiUser = res.data.user;

        await tokenStorage.set(token);
        setAccessToken(token);

        // Simpan sesi user aktif agar terbaca di Home dan Profile screen
        const userAccount: UserAccount = {
          id: `usr-${apiUser.id}`,
          email: apiUser.email,
          passwords: [password],
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
        return;
      } catch (apiErr: any) {
        // Jika server aktif dan menolak kredensial (password salah atau user tidak terdaftar)
        if (apiErr instanceof ApiError || apiErr?.status === 400 || apiErr?.status === 401) {
          setErrorMessage('Email atau kata sandi salah. Silakan periksa kembali.');
          return;
        }
        // Jika offline atau server belum aktif, lanjut ke pengecekan akun lokal
      }

      // 2. Fallback: Autentikasi akun lokal offline
      const authResult = await userStore.authenticate(identifier, password);
      if (authResult.success) {
        const token = `token-${authResult.user.id}`;
        await tokenStorage.set(token);
        setAccessToken(token);
        router.replace('/(app)/home');
        return;
      }

      // 3. Tampilkan pesan kesalahan yang jelas
      setErrorMessage(
        'Gagal login. Pastikan email & password benar, server backend di laptop sudah aktif (npm run dev), dan HP terhubung ke Wi-Fi yang sama.'
      );
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
        {/* Ikon Stopwatch Login Rek */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <MaterialCommunityIcons name="timer-check-outline" size={38} color="#05564E" />
          </View>
          <Text style={styles.brandTitle}>Login Rek</Text>
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

          {/* Tombol Masuk Langsung Cepat (Tanpa Ketik Akun) */}
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
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
              await tokenStorage.set('token-auto-demo');
              setAccessToken('token-auto-demo');
              router.replace('/(app)/home');
            }}
            style={{
              marginBottom: 14,
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: '#E6F4F5',
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: '#0E7C86',
            }}
          >
            <Text style={{ color: '#0E7C86', fontWeight: '700', fontSize: 15 }}>
              ? Masuk Langsung (Tanpa Ketik Akun)
            </Text>
          </Pressable>

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
