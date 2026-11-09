import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { getMediaUrl } from '@/config/env';
import * as ImagePicker from 'expo-image-picker';

import { authApi, ApiError, setAccessToken } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { userStore, UserAccount } from '@/lib/user-store';
import { permissionStore } from '@/lib/permission-store';

// Format jam realtime 24 jam (contoh: 13:00 untuk 1 siang, 16:00 untuk 4 sore)
function formatTime24(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} WIB`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentTime, setCurrentTime] = useState(() => formatTime24(new Date()));

  // Form state
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadUser = useCallback(async () => {
    const u = await userStore.getCurrentUser();
    if (!u) {
      router.replace('/(auth)/login');
      return;
    }
    setCurrentUser(u);
    setFullName(u.fullName);
    setImageError(false);

    try {
      const res = await authApi.me();
      if (res?.data?.avatarUrl) {
        if (u && u.avatarUrl !== res.data.avatarUrl) {
          const updated = { ...u, avatarUrl: res.data.avatarUrl };
          await userStore.setCurrentUser(updated);
          setCurrentUser(updated);
        }
      }
    } catch {}
  }, []);

  // Ambil data user aktif saat ini (re-sync setiap layar profil fokus)
  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  // Tarik ke bawah untuk refresh (Pull-to-Refresh)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentTime(formatTime24(new Date()));
    await loadUser();
    setRefreshing(false);
  }, [loadUser]);

  // Jam realtime berdetak setiap detik
  useEffect(() => {
    function updateClock() {
      setCurrentTime(formatTime24(new Date()));
    }
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simpan perubahan kata sandi
  async function handleSave() {
    if (!currentPassword && !newPassword) {
      Alert.alert(
        'Profil Tersimpan Otomatis 🎉',
        'Foto profil kamu sudah tersimpan secara otomatis tanpa perlu menekan tombol simpan.\n\nMasukkan kata sandi saat ini dan kata sandi baru jika ingin mengubah kata sandi akun.'
      );
      return;
    }

    if (!currentPassword) {
      Alert.alert('Perhatian', 'Silakan masukkan password saat ini.');
      return;
    }

    if (!newPassword) {
      Alert.alert('Perhatian', 'Silakan masukkan password baru.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Perhatian', 'Password baru minimal harus 8 karakter.');
      return;
    }

    // Ganti kata sandi diverifikasi server (wajib online); tidak ada penyimpanan kata sandi di HP.
    try {
      await authApi.updateProfile({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });
    } catch (apiErr: any) {
      if (apiErr instanceof ApiError) {
        Alert.alert('Gagal', apiErr.message || 'Password saat ini yang Anda masukkan salah.');
      } else {
        Alert.alert('Tidak ada koneksi', 'Ganti kata sandi membutuhkan koneksi internet. Coba lagi saat online.');
      }
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    Alert.alert('Sukses 🎉', 'Kata sandi berhasil diperbarui! Silakan gunakan kata sandi baru saat login berikutnya.');
  }

  // Ubah foto profil dari galeri perangkat dengan izin resmi
  async function handleChangePhoto() {
    try {
      // 1. Cek dan minta izin akses galeri foto (Media Library)
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Izin Galeri Diperlukan',
          'Login Rek membutuhkan izin akses ke galeri foto Anda agar Anda dapat memilih dan mengubah foto profil akun. Silakan berikan izin di Pengaturan.',
          [{ text: 'Mengerti' }]
        );
        return;
      }

      // 2. Buka galeri pemilih foto perangkat
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1], // Format persegi 1:1 untuk avatar profil
        quality: 0.35, // Ringan (~40-60KB) & tajam untuk avatar
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setIsUploadingPhoto(true);

        // 1. Simpan langsung ke memori lokal HP agar avatar seketika berubah di layar
        const updated = await userStore.updateAvatar(base64Data);
        if (updated) {
          setCurrentUser(updated);
        }

        // 2. Unggah otomatis ke server backend (Go / SQLite)
        let syncedToServer = false;
        if (currentUser?.email) {
          try {
            const apiRes = await authApi.updateProfile({
              avatarUrl: base64Data,
            });
            if (apiRes?.user?.avatarUrl) {
              await userStore.updateAvatar(apiRes.user.avatarUrl);
            }
            syncedToServer = true;
          } catch (apiErr: any) {
            console.warn('Gagal sync foto ke server:', apiErr?.message);
          }
        }

        Alert.alert(
          'Foto Profil Berhasil Diperbarui! 🎉',
          syncedToServer
            ? 'Foto profil kamu otomatis tersimpan dan langsung terupdate di Web Dashboard Admin.'
            : 'Foto profil tersimpan di HP dan akan otomatis tersinkron ke Web Dashboard saat server terhubung.'
        );
      }
    } catch (err: any) {
      Alert.alert('Gagal Mengambil Foto', err?.message || 'Terjadi kesalahan saat membuka galeri foto.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  // Buka dialog konfirmasi logout
  function handleLogout() {
    setShowLogoutModal(true);
  }

  // Eksekusi pembersihan sesi dan arahkan ke layar login
  async function executeLogout() {
    setShowLogoutModal(false);
    await userStore.clearCurrentUser();
    await tokenStorage.clear();
    await permissionStore.resetPermissions();
    setAccessToken(null);
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace('/(auth)/login');
  }

  // Navigasi ke Dashboard Home
  function goToHome() {
    router.replace('/(app)/home');
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0E7C86']}
              tintColor="#0E7C86"
              progressViewOffset={insets.top + 10}
            />
          }
        >
          {/* Top Header: Profil Singkat & Jam Realtime */}
          <View style={styles.topHeader}>
            <View>
              <Text style={styles.userName}>{fullName || currentUser?.fullName || 'Karyawan'}</Text>
              <Text style={styles.userRole}>{currentUser?.role ?? 'Karyawan'}</Text>
            </View>
            <View style={styles.clockPill}>
              <Feather name="clock" size={13} color="#047857" style={styles.clockIcon} />
              <Text style={styles.clockText}>{currentTime}</Text>
            </View>
          </View>

          {/* Sub Header: Edit Profil */}
          <View style={styles.pageTitleRow}>
            <Text style={styles.pageTitle}>Edit Profil</Text>
          </View>

          {/* Avatar Section */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarWrapper}>
              {(() => {
                const resolvedUrl = getMediaUrl(currentUser?.avatarUrl);
                return (
                  <Image
                    source={
                      !imageError && resolvedUrl
                        ? { uri: resolvedUrl }
                        : require('@/assets/default_avatar.png')
                    }
                    style={styles.avatarImage}
                    resizeMode="cover"
                    onError={() => {
                      setImageError(true);
                    }}
                  />
                );
              })()}
              {isUploadingPhoto && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              )}
              <Pressable
                style={styles.cameraBadge}
                onPress={handleChangePhoto}
                disabled={isUploadingPhoto}
                accessibilityLabel="Ubah foto profil"
              >
                <Feather name="camera" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
            <Pressable
              onPress={handleChangePhoto}
              disabled={isUploadingPhoto}
              hitSlop={8}
            >
              <Text style={styles.changePhotoText}>
                {isUploadingPhoto ? 'Memperbarui...' : 'Ubah Foto'}
              </Text>
            </Pressable>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Input Nama Lengkap (Read-only) */}
            <Text style={styles.inputLabel}>Nama Lengkap</Text>
            <View style={styles.inputBoxDisabled}>
              <Text style={styles.textInputDisabled}>{fullName || currentUser?.fullName || 'Karyawan'}</Text>
              <Feather name="lock" size={14} color="#94A3B8" />
            </View>

            {/* Garis Pemisah */}
            <View style={styles.divider} />

            {/* Sub-judul Ganti Kata Sandi */}
            <Text style={styles.sectionHeaderTitle}>Ganti Kata Sandi</Text>

            {/* Input Password Saat Ini */}
            <Text style={styles.passwordLabel}>Password Saat Ini</Text>
            <View style={styles.inputBoxWithIcon}>
              <TextInput
                style={styles.textInputFlex}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Masukkan password saat ini"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showCurrentPassword}
              />
              <Pressable
                onPress={() => setShowCurrentPassword((prev) => !prev)}
                hitSlop={8}
                style={styles.eyeIconBox}
              >
                <Feather
                  name={showCurrentPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color="#64748B"
                />
              </Pressable>
            </View>

            {/* Input Password Baru */}
            <Text style={styles.passwordLabel}>Password Baru</Text>
            <View style={styles.inputBoxWithIcon}>
              <TextInput
                style={styles.textInputFlex}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Minimal 8 karakter"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showNewPassword}
              />
              <Pressable
                onPress={() => setShowNewPassword((prev) => !prev)}
                hitSlop={8}
                style={styles.eyeIconBox}
              >
                <Feather
                  name={showNewPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color="#64748B"
                />
              </Pressable>
            </View>
          </View>

          {/* Tombol Simpan Perubahan */}
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
            ]}
          >
            <Text style={styles.saveButtonText}>Simpan Perubahan</Text>
          </Pressable>

          {/* Tombol Keluar dari Akun (Logout) */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
            ]}
          >
            <Feather name="log-out" size={18} color="#DC2626" style={styles.logoutIcon} />
            <Text style={styles.logoutButtonText}>Keluar dari Akun</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* Tab Riwayat */}
        <Pressable
          style={styles.tabButton}
          onPress={() => router.push('/(app)/history')}
        >
          <Feather name="rotate-ccw" size={22} color="#64748B" />
          <Text style={[styles.tabLabel, { color: '#64748B' }]}>Riwayat</Text>
        </Pressable>

        {/* Tab Tengah: Floating Tombol Beranda */}
        <View style={styles.centerFabContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Beranda"
            onPress={goToHome}
            style={({ pressed }) => [styles.fabButton, pressed && styles.fabButtonPressed]}
          >
            <Feather name="home" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.fabLabel, { color: '#64748B' }]}>Beranda</Text>
        </View>

        {/* Tab Profil (Aktif) */}
        <Pressable style={styles.tabButton} onPress={() => {}}>
          <Feather name="user" size={22} color="#05564E" />
          <Text style={[styles.tabLabel, { color: '#05564E', fontWeight: '700' }]}>Profil</Text>
        </Pressable>
      </View>

      {/* Modal Konfirmasi Keluar / Logout */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowLogoutModal(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalIconBox}>
              <Feather name="log-out" size={26} color="#DC2626" />
            </View>

            <Text style={styles.modalTitle}>Keluar dari Akun?</Text>
            <Text style={styles.modalMessage}>
              Sesi login Anda akan diakhiri. Anda perlu memasukkan email dan kata sandi kembali untuk masuk.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmBtn}
                onPress={executeLogout}
              >
                <Text style={styles.modalConfirmText}>Ya, Keluar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F1F24',
    letterSpacing: -0.2,
  },
  userRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  clockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  clockIcon: {
    marginRight: 6,
  },
  clockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F1F24',
    letterSpacing: -0.3,
  },
  saveLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B7369',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    width: 104,
    height: 104,
    borderRadius: 52,
    marginBottom: 10,
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#E2E8F0',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0B7369',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B7369',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDF2F4',
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F1F24',
    marginBottom: 8,
  },
  inputBoxDisabled: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textInputDisabled: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  inputBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F1F24',
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 18,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F1F24',
    marginBottom: 12,
  },
  passwordLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 8,
  },
  inputBoxWithIcon: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInputFlex: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F1F24',
    padding: 0,
  },
  eyeIconBox: {
    padding: 4,
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#0B7369',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#0B7369',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonPressed: {
    backgroundColor: '#08554E',
    transform: [{ scale: 0.99 }],
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  logoutButtonPressed: {
    backgroundColor: '#FEE2E2',
    transform: [{ scale: 0.99 }],
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: -0.2,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 10,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  centerFabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -18,
    flex: 1,
  },
  fabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#05564E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#05564E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabButtonPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: '#033F39',
  },
  fabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F1F24',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
