import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, Camera } from 'expo-camera';
import * as Location from 'expo-location';

import { userStore, UserAccount } from '@/lib/user-store';
import { permissionStore } from '@/lib/permission-store';
import { locationStore, OfficeConfig } from '@/lib/location-store';
import { syncStore } from '@/lib/sync-store';
import { attendanceApi } from '@/lib/api';

// Format jam realtime digital 24 jam (HH:mm:ss WIB)
function formatTime24(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} WIB`;
}

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentTime, setCurrentTime] = useState(() => formatTime24(new Date()));

  // Status izin kamera & lokasi
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean>(false);

  // Ref kamera native (Expo Camera) dan Web Video
  const cameraRef = useRef<CameraView>(null);
  const videoRef = useRef<any>(null);
  const [cameraStream, setCameraStream] = useState<any>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // State untuk alur Konfirmasi Foto Presensi (Sesuai Desain Figma)
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [capturedTime, setCapturedTime] = useState<string>('08.00');
  const [capturedIsLate, setCapturedIsLate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Nilai animasi native (Sangat ringan, 60 FPS di GPU tanpa beban CPU)
  const flashAnim = useRef(new Animated.Value(0)).current;
  const previewFadeAnim = useRef(new Animated.Value(0)).current;
  const previewSlideAnim = useRef(new Animated.Value(20)).current;

  // Status Validasi Geofence Radius Kantor (Pencegah Curang)
  const [isInsideOffice, setIsInsideOffice] = useState<boolean>(true);
  const [officeDistance, setOfficeDistance] = useState<number>(0);
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Pantau status koneksi internet (online / offline)
  useEffect(() => {
    async function checkNet() {
      const online = await syncStore.isOnline();
      setIsOnline(online);
    }
    checkNet();
    const unsub = syncStore.subscribeNetworkState((online) => {
      setIsOnline(online);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Verifikasi apakah karyawan berada di dalam radius kantor
  async function checkGeofence() {
    try {
      const res = await locationStore.verifyLocation();
      setIsInsideOffice(res.isInside);
      setOfficeDistance(res.distanceMeters);
      setOfficeConfig(res.office);
      return res;
    } catch {
      return null;
    }
  }

  // Ambil profil user dan status izin tersimpan
  useEffect(() => {
    async function init() {
      const u = await userStore.getCurrentUser();
      if (u) {
        setCurrentUser(u);
        if (u.todayCheckIn) {
          Alert.alert(
            'Sudah Absen Hari Ini',
            `Kamu sudah melakukan absensi masuk hari ini pada pukul ${u.todayCheckIn.time} WIB.`,
            [
              { text: 'Ke Menu Utama', onPress: () => router.replace('/(app)/home') },
              { text: 'OK' },
            ]
          );
        }
      }

      if (Platform.OS !== 'web') {
        try {
          const camStatus = await Camera.getCameraPermissionsAsync();
          const locStatus = await Location.getForegroundPermissionsAsync();
          setHasCameraPermission(camStatus.granted);
          setHasLocationPermission(locStatus.granted);
          if (locStatus.granted) {
            checkGeofence();
          }
        } catch (e) {
          console.warn('Gagal cek izin native:', e);
        }
      } else {
        const cam = await permissionStore.getCameraPermission();
        const loc = await permissionStore.getLocationPermission();
        setHasCameraPermission(cam);
        setHasLocationPermission(loc);
        if (loc) {
          checkGeofence();
        }
      }
    }
    init();
  }, []);

  // Jam realtime berdetak setiap detik
  useEffect(() => {
    function updateClock() {
      setCurrentTime(formatTime24(new Date()));
    }
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Nyalakan stream kamera asli jika izin kamera & lokasi sudah aktif
  const isFullyPermitted = hasCameraPermission && hasLocationPermission;

  useEffect(() => {
    let activeStream: any = null;

    async function startLiveCamera() {
      if (isFullyPermitted && Platform.OS === 'web') {
        try {
          if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user' },
              audio: false,
            });
            activeStream = stream;
            setCameraStream(stream);
          }
        } catch (err) {
          console.warn('Gagal mengakses kamera perangkat:', err);
        }
      }
    }

    startLiveCamera();

    return () => {
      if (activeStream) {
        try {
          activeStream.getTracks().forEach((track: any) => track.stop());
        } catch {
          // Abaikan
        }
      }
    };
  }, [isFullyPermitted]);

  // Pasang stream ke elemen video saat ref siap
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      try {
        videoRef.current.srcObject = cameraStream;
        videoRef.current.play?.().catch(() => {});
      } catch {
        // Abaikan
      }
    }
  }, [cameraStream, isFullyPermitted]);

  // Aksi Beri Izin Kamera Asli
  async function handleGrantCamera() {
    if (Platform.OS !== 'web') {
      try {
        const res = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(res.granted);
        await permissionStore.setCameraPermission(res.granted);
        if (!res.granted) {
          Alert.alert(
            'Izin Kamera Ditolak',
            'Harap izinkan akses kamera di Pengaturan iPhone Anda untuk melakukan presensi.'
          );
        }
      } catch (err: any) {
        Alert.alert('Gagal Meminta Izin Kamera', err?.message || 'Terjadi kesalahan.');
      }
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      Alert.alert(
        'Info Keamanan Browser',
        'Safari iPhone mewajibkan koneksi HTTPS (misal via Expo Tunnel) untuk membuka kamera fisik asli. Tetap mengizinkan simulasi kamera.'
      );
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        setCameraStream(stream);
      } catch (err: any) {
        console.warn('Izin kamera ditolak atau perangkat tidak tersedia:', err);
      }
    }

    await permissionStore.setCameraPermission(true);
    setHasCameraPermission(true);
  }

  // Aksi Beri Izin Lokasi Asli
  async function handleGrantLocation() {
    if (Platform.OS !== 'web') {
      try {
        const res = await Location.requestForegroundPermissionsAsync();
        setHasLocationPermission(res.granted);
        await permissionStore.setLocationPermission(res.granted);
        if (res.granted) {
          checkGeofence();
        }
        if (!res.granted) {
          Alert.alert(
            'Izin Lokasi Ditolak',
            'Harap izinkan akses lokasi di Pengaturan iPhone Anda untuk memverifikasi kehadiran di kantor.'
          );
        }
      } catch (err: any) {
        Alert.alert('Gagal Meminta Izin Lokasi', err?.message || 'Terjadi kesalahan.');
      }
      return;
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async () => {
          await permissionStore.setLocationPermission(true);
          setHasLocationPermission(true);
        },
        async () => {
          await permissionStore.setLocationPermission(true);
          setHasLocationPermission(true);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
      return;
    }

    await permissionStore.setLocationPermission(true);
    setHasLocationPermission(true);
  }

  // Aksi Menjepret Foto Presensi (Shutter Button)
  async function handleCapturePhoto() {
    if (currentUser?.todayCheckIn) {
      Alert.alert(
        'Sudah Absen Hari Ini',
        `Kamu sudah melakukan absensi masuk hari ini pada pukul ${currentUser.todayCheckIn.time} WIB.`,
        [
          { text: 'Ke Menu Utama', onPress: () => router.replace('/(app)/home') },
          { text: 'OK' },
        ]
      );
      return;
    }

    // Validasi: jika izin belum lengkap, karyawan tidak bisa absen
    if (!hasCameraPermission) {
      Alert.alert(
        'Izin Kamera Diperlukan',
        'Harap berikan izin kamera terlebih dahulu untuk melakukan presensi.'
      );
      return;
    }
    if (!hasLocationPermission) {
      Alert.alert(
        'Izin Lokasi Diperlukan',
        'Harap aktifkan layanan lokasi (GPS) terlebih dahulu untuk melakukan presensi.'
      );
      return;
    }

    // Validasi Geofence: Karyawan HARUS berada di dalam kantor Piposmart (Anti-Curang)
    const locRes = await checkGeofence();
    if (locRes && !locRes.isInside) {
      Alert.alert(
        'Presensi Ditolak (Di Luar Kantor) 🚫',
        `Kamu terdeteksi berada di luar area ${locRes.office.name} sejauh ${locRes.distanceMeters} meter.\n\nPresensi hanya dapat dilakukan jika kamu sudah berada di dalam kantor Piposmart (maksimal ${locRes.office.radiusMeters} meter). Karyawan tidak dapat melakukan absensi dari rumah atau luar kantor.`,
        [
          { text: 'Cek Lokasi Lagi', onPress: () => checkGeofence() },
          { text: 'Tutup', style: 'cancel' },
        ]
      );
      return;
    }

    setIsCapturing(true);
    try {
      let photoUri: string | null = null;
      if (Platform.OS !== 'web' && cameraRef.current?.takePictureAsync) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          mirror: false,
        });
        photoUri = photo?.uri ?? null;
      } else if (Platform.OS === 'web' && videoRef.current) {
        try {
          const video = videoRef.current;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            photoUri = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch {
          photoUri = null;
        }
      }

      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 0);
      const timeFormatted = `${h}.${m}`;

      // Efek shutter flash kamera (120ms mikro-animasi native yang sangat ringan)
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 0.9,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();

      previewFadeAnim.setValue(0);
      previewSlideAnim.setValue(20);

      // Pindahkan ke mode preview konfirmasi foto
      setCapturedPhotoUri(photoUri || 'fallback');
      setCapturedTime(timeFormatted);
      setCapturedIsLate(isLate);

      // Slide & fade in halus (220ms - snappy & responsif)
      Animated.parallel([
        Animated.timing(previewFadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(previewSlideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err: any) {
      Alert.alert('Gagal Mengambil Foto', err?.message || 'Terjadi kesalahan saat memproses kamera.');
    } finally {
      setIsCapturing(false);
    }
  }

  // Aksi Foto Ulang (Jika karyawan merasa fotonya kurang bagus)
  function handleRetakePhoto() {
    Animated.timing(previewFadeAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setCapturedPhotoUri(null);
    });
  }

  // Aksi Kirim Presensi (Konfirmasi dan kembali ke Menu Utama)
  async function handleConfirmAttendance() {
    setIsSubmitting(true);
    try {
      const online = await syncStore.isOnline();

      const photoToSave =
        capturedPhotoUri && capturedPhotoUri !== 'fallback'
          ? capturedPhotoUri
          : currentUser?.avatarUrl || undefined;

      const updated = await userStore.recordAttendance(
        capturedTime,
        capturedIsLate,
        photoToSave
      );
      if (updated) {
        setCurrentUser(updated);
      }

      if (!online && currentUser) {
        // Simpan ke antrean sinkronisasi offline di memori HP
        await syncStore.addToQueue({
          email: currentUser.email,
          capturedTime,
          isLate: capturedIsLate,
          photoUri: photoToSave,
          latitude: officeConfig?.latitude ?? 1.105925,
          longitude: officeConfig?.longitude ?? 104.075342,
        });

        Alert.alert(
          'Presensi Dicatat (Mode Offline) 📲',
          `Kamu sedang tidak terhubung ke internet/Wi-Fi. Absensi masuk kamu tetap tercatat sah pada pukul ${capturedTime} WIB dan tersimpan aman di HP.\n\nData akan otomatis disinkronkan ke server saat HP kembali online.`,
          [
            {
              text: 'Ke Menu Utama',
              onPress: () => router.replace('/(app)/home'),
            },
          ]
        );
      } else {
        // Kirim langsung ke backend REST API
        if (currentUser) {
          try {
            await attendanceApi.checkIn({
              clockInTime: `${capturedTime} WIB`,
              isLate: capturedIsLate,
              photo: photoToSave,
              latitude: officeConfig?.latitude ?? 1.105925,
              longitude: officeConfig?.longitude ?? 104.075342,
              distanceMeters: Math.round(officeDistance),
              officeName: officeConfig?.name ?? 'Kantor Piposmart',
              isOfflineSync: false,
            });
          } catch {
            // Jika request ke server gagal/timeout, masukkan ke queue offline agar tidak hilang
            await syncStore.addToQueue({
              email: currentUser.email,
              capturedTime,
              isLate: capturedIsLate,
              photoUri: photoToSave,
              latitude: officeConfig?.latitude ?? 1.105925,
              longitude: officeConfig?.longitude ?? 104.075342,
            });
          }
        }

        Alert.alert(
          'Presensi Berhasil Terkirim! 🎉',
          `Absensi masuk kamu telah tercatat pada pukul ${capturedTime} WIB (${capturedIsLate ? 'Terlambat' : 'Tepat Waktu'}).`,
          [
            {
              text: 'Ke Menu Utama',
              onPress: () => router.replace('/(app)/home'),
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Gagal Mengirim Presensi', err?.message || 'Terjadi kesalahan saat menyimpan presensi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Evaluasi mode layar saat ini berdasarkan izin
  const isCameraPermissionMissing = !hasCameraPermission;
  const isLocationPermissionMissing = hasCameraPermission && !hasLocationPermission;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Top Header: Tombol Kembali ke Home, Profil Singkat & Jam Realtime */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeftWithBack}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Beranda"
            onPress={() => router.replace('/(app)/home')}
            style={({ pressed }) => [styles.headerBackBtn, pressed && styles.headerBackBtnPressed]}
            hitSlop={12}
          >
            <Feather name="chevron-left" size={26} color="#0F1F24" />
          </Pressable>
          <View>
            <Text style={styles.userName}>{currentUser?.fullName ?? 'Timmy Kurniawan'}</Text>
            <Text style={styles.userRole}>{currentUser?.role ?? 'Software Engineer'}</Text>
          </View>
        </View>
        <View style={styles.clockPill}>
          <Feather name="clock" size={13} color="#047857" style={styles.clockIcon} />
          <Text style={styles.clockText}>{currentTime}</Text>
        </View>
      </View>

      {/* ============================================================== */}
      {/* TAMPILAN PREVIEW & KONFIRMASI FOTO (1:1 Sesuai Screenshot)     */}
      {/* ============================================================== */}
      {capturedPhotoUri ? (
        <Animated.View
          style={[
            styles.previewContainer,
            {
              opacity: previewFadeAnim,
              transform: [{ translateY: previewSlideAnim }],
            },
          ]}
        >
          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Foto Selfie Karyawan (Dibalik horizontal agar normal sesuai tampilan kamera & tidak mirror) */}
            <View style={styles.previewPhotoCard}>
              <Image
                source={
                  capturedPhotoUri !== 'fallback'
                    ? { uri: capturedPhotoUri }
                    : require('@/assets/budi_avatar.jpg')
                }
                style={[
                  styles.previewPhotoImage,
                  capturedPhotoUri !== 'fallback' && { transform: [{ scaleX: -1 }] },
                ]}
                resizeMode="cover"
              />
            </View>

            {/* Card Waktu Absen Tercatat */}
            <View style={styles.previewCard}>
              <View style={styles.clockIconBox}>
                <Feather name="clock" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.previewCardInfo}>
                <Text style={styles.previewCardHeaderTitle}>WAKTU ABSEN TERCATAT</Text>
                <View style={styles.previewTimeValueRow}>
                  <Text style={styles.previewTimeValueText}>{capturedTime}</Text>
                  <Text style={styles.previewTimeWibText}>WIB</Text>
                </View>
              </View>
            </View>

            {/* Card Status Kehadiran */}
            <View style={styles.previewStatusCard}>
              <Text style={styles.previewCardHeaderTitle}>STATUS KEHADIRAN</Text>
              <View
                style={[
                  styles.statusBadgePill,
                  capturedIsLate ? styles.statusBadgePillLate : styles.statusBadgePillOnTime,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgePillText,
                    capturedIsLate ? styles.statusBadgeTextLate : styles.statusBadgeTextOnTime,
                  ]}
                >
                  {capturedIsLate ? 'Terlambat' : 'Tepat Waktu'}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Bar Aksi Bawah: Foto Ulang & Kirim Presensi */}
          <View style={[styles.previewActionFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Foto Ulang"
              onPress={handleRetakePhoto}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.retakeBtn,
                pressed && styles.retakeBtnPressed,
              ]}
            >
              <Feather name="rotate-ccw" size={17} color="#1E293B" style={{ marginRight: 8 }} />
              <Text style={styles.retakeBtnText}>Foto Ulang</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kirim Presensi"
              onPress={handleConfirmAttendance}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && styles.confirmBtnPressed,
                isSubmitting && { opacity: 0.8 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmBtnText}>Kirim Presensi</Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      ) : (
        <>
          {/* ============================================================== */}
          {/* KONDISI 1: KAMERA BELUM DIIZINKAN                             */}
          {/* ============================================================== */}
          {isCameraPermissionMissing && (
        <ScrollView
          style={styles.permissionScroll}
          contentContainerStyle={styles.permissionContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Ilustrasi Lingkaran Kamera Non-Aktif & Gembok Merah */}
          <View style={styles.illustrationCircle}>
            <MaterialCommunityIcons name="camera-off-outline" size={54} color="#64748B" />
            <View style={styles.padlockBadge}>
              <Feather name="lock" size={14} color="#DC2626" />
            </View>
          </View>

          {/* Judul & Penjelasan */}
          <Text style={styles.permissionTitle}>Kamera belum diizinkan</Text>
          <Text style={styles.permissionSubtitle}>
            Login Rek butuh kamera untuk foto absen. Buka Pengaturan untuk mengizinkan.
          </Text>

          {/* Card Panduan Singkat (3 Langkah) */}
          <View style={styles.guideCard}>
            <View style={styles.guideCardHeader}>
              <View style={styles.questionIconBadge}>
                <Feather name="help-circle" size={16} color="#0E7C86" />
              </View>
              <Text style={styles.guideCardTitle}>Panduan Singkat</Text>
            </View>

            {/* Langkah 1 */}
            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Buka Pengaturan aplikasi</Text>
            </View>

            {/* Langkah 2 */}
            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Pilih menu Izin / Permissions</Text>
            </View>

            {/* Langkah 3 */}
            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Aktifkan akses Kamera</Text>
            </View>
          </View>

          {/* Tombol Aksi: Buka Pengaturan & Kembali ke Beranda */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka Pengaturan Kamera"
            onPress={handleGrantCamera}
            style={({ pressed }) => [styles.primaryActionBtn, pressed && styles.primaryActionBtnPressed]}
          >
            <Text style={styles.primaryActionBtnText}>Buka Pengaturan</Text>
            <Feather name="external-link" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Beranda"
            onPress={() => router.replace('/(app)/home')}
            style={styles.backLinkBtn}
            hitSlop={8}
          >
            <Text style={styles.backLinkText}>Kembali ke Beranda</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ============================================================== */}
      {/* KONDISI 2: LOKASI BELUM AKTIF                                 */}
      {/* ============================================================== */}
      {isLocationPermissionMissing && (
        <ScrollView
          style={styles.permissionScroll}
          contentContainerStyle={styles.permissionContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Ilustrasi Lingkaran Lokasi Non-Aktif */}
          <View style={styles.illustrationCircle}>
            <MaterialCommunityIcons name="map-marker-off-outline" size={54} color="#64748B" />
          </View>

          {/* Judul & Penjelasan */}
          <Text style={styles.permissionTitle}>Lokasi belum aktif</Text>
          <Text style={styles.permissionSubtitle}>
            Login Rek butuh akses lokasi untuk memastikan kamu berada di area kantor saat presensi. Buka Pengaturan untuk mengizinkan.
          </Text>

          {/* Card Panduan Cepat (3 Langkah dengan Keterangan Rinci) */}
          <View style={styles.guideCard}>
            <View style={styles.guideCardHeaderWithBadge}>
              <Text style={styles.guideCardTitle}>Panduan Cepat</Text>
              <View style={styles.langkahPill}>
                <Text style={styles.langkahPillText}>3 LANGKAH</Text>
              </View>
            </View>

            {/* Langkah 1 */}
            <View style={styles.stepRowDetailed}>
              <View style={styles.stepNumberBadgeGray}>
                <Text style={styles.stepNumberTextGray}>1</Text>
              </View>
              <View style={styles.stepDetailInfo}>
                <Text style={styles.stepDetailTitle}>Buka Pengaturan perangkat</Text>
                <Text style={styles.stepDetailSubtitle}>Masuk ke menu setelan privasi atau aplikasi</Text>
              </View>
            </View>

            {/* Langkah 2 */}
            <View style={styles.stepRowDetailed}>
              <View style={styles.stepNumberBadgeGray}>
                <Text style={styles.stepNumberTextGray}>2</Text>
              </View>
              <View style={styles.stepDetailInfo}>
                <Text style={styles.stepDetailTitle}>Aktifkan Layanan Lokasi (GPS)</Text>
                <Text style={styles.stepDetailSubtitle}>Pastikan mode akurasi tinggi menyala</Text>
              </View>
            </View>

            {/* Langkah 3 */}
            <View style={styles.stepRowDetailed}>
              <View style={styles.stepNumberBadgeGray}>
                <Text style={styles.stepNumberTextGray}>3</Text>
              </View>
              <View style={styles.stepDetailInfo}>
                <Text style={styles.stepDetailTitle}>Beri izin lokasi 'Saat Aplikasi Digunakan'</Text>
                <Text style={styles.stepDetailSubtitle}>Pilih opsi ini agar presensi tervalidasi otomatis</Text>
              </View>
            </View>
          </View>

          {/* Tombol Aksi: Buka Pengaturan & Kembali ke Beranda */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka Pengaturan Lokasi"
            onPress={handleGrantLocation}
            style={({ pressed }) => [styles.primaryActionBtn, pressed && styles.primaryActionBtnPressed]}
          >
            <Feather name="settings" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionBtnText}>Buka Pengaturan</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Beranda"
            onPress={() => router.replace('/(app)/home')}
            style={styles.backLinkBtn}
            hitSlop={8}
          >
            <Text style={styles.backLinkText}>Kembali ke Beranda</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ============================================================== */}
      {/* KONDISI 3: KAMERA & LOKASI AKTIF (Viewfinder Live / Asli)     */}
      {/* ============================================================== */}
      {isFullyPermitted && (
        <View style={styles.cameraContainer}>
          {/* Kamera Asli di HP (iOS / Android) */}
          {Platform.OS !== 'web' ? (
            <CameraView
              ref={cameraRef}
              style={styles.cameraBackground}
              facing="front"
              mirror={false}
            />
          ) : cameraStream ? (
            React.createElement('video', {
              ref: videoRef,
              autoPlay: true,
              playsInline: true,
              muted: true,
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              },
            })
          ) : (
            /* Fallback foto kantor jika kamera fisik belum aktif / diizinkan browser */
            <Image
              source={require('@/assets/office_camera_bg.jpg')}
              style={styles.cameraBackground}
              resizeMode="cover"
            />
          )}

          {/* Overlay Gelap Transparan Tipis */}
          <View style={styles.cameraDarkOverlay} pointerEvents="none" />

          {/* Teks Instruksi di Bagian Atas Sesuai Figma */}
          <View style={styles.instructionBox} pointerEvents="none">
            <Text style={styles.instructionText}>
              Pastikan pencahayaan cukup dan wajah terlihat jelas
            </Text>

            {/* Indikator Status Lokasi Kantor (Pencegah Curang) */}
            <View
              style={[
                styles.geofencePill,
                isInsideOffice ? styles.geofencePillInside : styles.geofencePillOutside,
              ]}
            >
              <Feather
                name={isInsideOffice ? 'check-circle' : 'alert-triangle'}
                size={11}
                color={isInsideOffice ? '#047857' : '#B45309'}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.geofencePillText,
                  isInsideOffice ? styles.geofenceTextInside : styles.geofenceTextOutside,
                ]}
              >
                {isInsideOffice
                  ? `Di Dalam Kantor Piposmart (${officeDistance}m)`
                  : `Di Luar Kantor (${officeDistance}m / Maks ${officeConfig?.radiusMeters ?? 100}m)`}
              </Text>
            </View>

            {/* Indikator Mode Offline jika koneksi tidak tersedia */}
            {!isOnline && (
              <View style={styles.offlineNetworkPill}>
                <Feather name="wifi-off" size={11} color="#D97706" style={{ marginRight: 5 }} />
                <Text style={styles.offlineNetworkPillText}>Mode Offline (Tersimpan di HP)</Text>
              </View>
            )}
          </View>

          {/* Frame Oval Panduan Wajah dengan Garis Putus-Putus Mint & Crosshair */}
          <View style={styles.reticleContainer} pointerEvents="none">
            <View style={styles.ovalReticle}>
              {/* Garis Crosshair Plus di Tengah */}
              <View style={styles.crosshairVertical} />
              <View style={styles.crosshairHorizontal} />
            </View>
          </View>
        </View>
      )}

      {/* ============================================================== */}
      {/* BOTTOM NAVIGATION BAR (1:1 Sesuai Figma)                       */}
      {/* ============================================================== */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* Tab Riwayat */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Riwayat"
          style={styles.tabButton}
          onPress={() => router.push('/(app)/history')}
        >
          <Feather name="rotate-ccw" size={22} color="#64748B" />
          <Text style={[styles.tabLabel, { color: '#64748B' }]}>Riwayat</Text>
        </Pressable>

        {/* Tab Tengah: Floating Tombol Kamera / Shutter Presensi */}
        <View style={styles.centerFabContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tombol Presensi"
            onPress={handleCapturePhoto}
            disabled={isCapturing}
            style={({ pressed }) => [
              styles.fabButton,
              pressed && styles.fabButtonPressed,
              isCapturing && { opacity: 0.8 },
            ]}
          >
            {isCapturing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Feather name="camera" size={26} color="#FFFFFF" />
            )}
          </Pressable>
          <Text style={[styles.fabLabel, { color: '#05564E', fontWeight: '700' }]}>
            {isCapturing ? 'Menjepret…' : 'Presensi'}
          </Text>
        </View>

        {/* Tab Profil */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profil"
          style={styles.tabButton}
          onPress={() => router.push('/(app)/profile')}
        >
          <Feather name="user" size={22} color="#64748B" />
          <Text style={[styles.tabLabel, { color: '#64748B' }]}>Profil</Text>
        </Pressable>
      </View>
        </>
      )}

      {/* Efek Shutter Flash Kamera (Ringan, Native GPU) */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#FFFFFF',
            opacity: flashAnim,
            zIndex: 999,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    zIndex: 10,
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
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  cameraDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  instructionBox: {
    position: 'absolute',
    top: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 5,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 18,
  },
  reticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovalReticle: {
    width: 210,
    height: 310,
    borderRadius: 105,
    borderWidth: 2.5,
    borderColor: '#5EEAD4',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#5EEAD4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  crosshairVertical: {
    position: 'absolute',
    width: 1.5,
    height: 20,
    backgroundColor: '#5EEAD4',
    opacity: 0.85,
  },
  crosshairHorizontal: {
    position: 'absolute',
    width: 20,
    height: 1.5,
    backgroundColor: '#5EEAD4',
    opacity: 0.85,
  },
  permissionScroll: {
    flex: 1,
  },
  permissionContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    alignItems: 'center',
  },
  illustrationCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 10,
    marginBottom: 16,
  },
  padlockBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F1F24',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  permissionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  guideCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDF2F4',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#EDF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  guideCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F1F24',
  },
  guideCardHeaderWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  langkahPill: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  langkahPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  stepRowDetailed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepNumberBadgeGray: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberTextGray: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  stepDetailInfo: {
    flex: 1,
  },
  stepDetailTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  stepDetailSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  primaryActionBtn: {
    backgroundColor: '#05564E',
    borderRadius: 14,
    height: 50,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#05564E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 14,
  },
  primaryActionBtnPressed: {
    backgroundColor: '#033F39',
    transform: [{ scale: 0.99 }],
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backLinkBtn: {
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#05564E',
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
    zIndex: 20,
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
  // ==============================================================
  // GAYA PREVIEW & KONFIRMASI FOTO PRESENSI (1:1 Screenshot)
  // ==============================================================
  previewContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  previewPhotoCard: {
    width: '100%',
    height: 380,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0F1F24',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  previewPhotoImage: {
    width: '100%',
    height: '100%',
  },
  previewCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDF2F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  clockIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#05564E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  previewCardInfo: {
    flex: 1,
  },
  previewCardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  previewTimeValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  previewTimeValueText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F1F24',
    letterSpacing: -0.5,
  },
  previewTimeWibText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
  },
  previewStatusCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDF2F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  statusBadgePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgePillLate: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgePillOnTime: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeTextLate: {
    color: '#B45309',
  },
  statusBadgeTextOnTime: {
    color: '#047857',
  },
  previewActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  retakeBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  retakeBtnPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.98 }],
  },
  retakeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  confirmBtn: {
    flex: 1.4,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#05564E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#05564E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnPressed: {
    backgroundColor: '#033F39',
    transform: [{ scale: 0.98 }],
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerLeftWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#F1F5F9',
  },
  headerBackBtnPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.95 }],
  },
  geofencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginTop: 8,
  },
  geofencePillInside: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  geofencePillOutside: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  geofencePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  geofenceTextInside: {
    color: '#047857',
  },
  geofenceTextOutside: {
    color: '#B45309',
  },
  offlineNetworkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginTop: 6,
  },
  offlineNetworkPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
});
