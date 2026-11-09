import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { attendanceApi, setAccessToken } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { userStore, UserAccount, AttendanceRecord } from '@/lib/user-store';
import { syncStore } from '@/lib/sync-store';
import { getMediaUrl } from '@/config/env';

export type AttendanceStatus =
  | 'holiday'    // Hari Libur
  | 'closed'     // Kantor Tutup
  | 'not_yet'    // belum Absen
  | 'on_time'    // Tepat Waktu
  | 'late';      // Terlambat

interface StatusConfig {
  title: string;
  gradient: [string, string, ...string[]];
  bagIconColor: string;
  bagBgColor: string;
  officeHours: string;
  checkInTime: string;
  checkInColor: string;
  checkInBg: string;
}

const STATUS_CONFIGS: Record<AttendanceStatus, StatusConfig> = {
  holiday: {
    title: 'Hari Libur',
    gradient: ['#7A1D28', '#64151E', '#4D1016'],
    bagIconColor: '#991B1B',
    bagBgColor: '#FEE2E2',
    officeHours: '---',
    checkInTime: '---',
    checkInColor: '#6B7280',
    checkInBg: '#F3F4F6',
  },
  closed: {
    title: 'Kantor Tutup',
    gradient: ['#7A1D28', '#64151E', '#4D1016'],
    bagIconColor: '#991B1B',
    bagBgColor: '#FEE2E2',
    officeHours: '08.00 → 17.00 WIB',
    checkInTime: '---',
    checkInColor: '#6B7280',
    checkInBg: '#F3F4F6',
  },
  not_yet: {
    title: 'belum Absen',
    gradient: ['#E69500', '#D97706', '#B45309'],
    bagIconColor: '#D97706',
    bagBgColor: '#FEF3C7',
    officeHours: '08.00 → 17.00 WIB',
    checkInTime: '---',
    checkInColor: '#6B7280',
    checkInBg: '#F3F4F6',
  },
  on_time: {
    title: 'Tepat Waktu',
    gradient: ['#0E7C86', '#09636C', '#05484E'],
    bagIconColor: '#0E7C86',
    bagBgColor: '#E6F4EA',
    officeHours: '08.00 → 17.00 WIB',
    checkInTime: '08.00 WIB',
    checkInColor: '#D97706',
    checkInBg: '#FEF3C7',
  },
  late: {
    title: 'Terlambat',
    gradient: ['#2F6FEB', '#2563EB', '#1D4ED8'],
    bagIconColor: '#2563EB',
    bagBgColor: '#DBEAFE',
    officeHours: '08.00 → 17.00 WIB',
    checkInTime: '08.30 WIB',
    checkInColor: '#D97706',
    checkInBg: '#FEF3C7',
  },
};

const RECENT_PRESENSI: { id: string; day: string; time: string; status: 'Tepat Waktu' | 'Terlambat' }[] = [];

const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDO_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

// Format hari, tanggal, bulan, dan tahun (misal: "Selasa, 27 Oktober 2026")
function formatFullDateIndonesian(date: Date): string {
  const dayName = INDO_DAYS[date.getDay()];
  const dayNum = date.getDate();
  const monthName = INDO_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

// Format jam dalam format 24 jam (misal 13:00 untuk jam 1 siang, 16:00 untuk jam 4 sore)
function formatTime24(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} WIB`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [currentTime, setCurrentTime] = useState(() => formatTime24(new Date()));
  const [todayCheckIn, setTodayCheckIn] = useState<{ time: string; isLate: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Background Auto-Sync: sinkronkan secara otomatis dan senyap di latar belakang
  const triggerAutoSync = useCallback(async () => {
    try {
      const online = await syncStore.isOnline();
      if (!online) return;
      const count = await syncStore.getPendingCount();
      if (count > 0) {
        await syncStore.syncPending();
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    let u = await userStore.getCurrentUser();
    if (!u) {
      router.replace('/(auth)/login');
      return;
    }
    setCurrentUser(u);
    setTodayCheckIn(u.todayCheckIn ?? null);

    try {
      const res = await attendanceApi.getToday();
      if (res?.data) {
        if (res.data.hasAttended && res.data.attendance) {
          const att = res.data.attendance;
          setTodayCheckIn({ time: att.clockInTime, isLate: att.isLate });
          if (u) {
            // Sinkronkan ke riwayat presensi lokal agar langsung muncul di HP ini
            const currentHistory = u.history || [];
            const alreadyInHistory = currentHistory.some(
              (h) => h.time.includes(att.clockInTime) || (h.id && h.id === String(att.id))
            );

            let updatedHistory = currentHistory;
            if (!alreadyInHistory) {
              const now = new Date();
              const dateNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
              const dayName = dateNames[now.getDay()];
              const dateNum = now.getDate();
              const monthName = monthNames[now.getMonth()];
              const year = now.getFullYear();

              const newRecord: AttendanceRecord = {
                id: String(att.id || Date.now()),
                day: `Hari ini, ${dayName} ${dateNum} ${monthName} ${year}`,
                time: `Jam Masuk: ${att.clockInTime} WIB`,
                status: att.isLate ? 'Terlambat' : 'Tepat Waktu',
                photoUri: att.photoPath ? getMediaUrl(att.photoPath) ?? undefined : undefined,
              };
              updatedHistory = [newRecord, ...currentHistory.slice(0, 4)];
            }

            const synced: UserAccount = {
              ...u,
              todayCheckIn: {
                date: res.data.today,
                time: att.clockInTime,
                isLate: att.isLate,
                photoUri: att.photoPath ? getMediaUrl(att.photoPath) ?? undefined : u.todayCheckIn?.photoUri,
              },
              history: updatedHistory,
              onTimeCount: !att.isLate ? Math.max(u.onTimeCount, 1) : u.onTimeCount,
              lateCount: att.isLate ? Math.max(u.lateCount, 1) : u.lateCount,
            };
            await userStore.setCurrentUser(synced);
            setCurrentUser(synced);
            u = synced;
          }
        } else if (!res.data.hasAttended) {
          const pendingCount = await syncStore.getPendingCount();
          const todayStr = new Date().toISOString().slice(0, 10);
          const localHasCheckedInToday = u?.todayCheckIn?.date === todayStr;

          // Jangan pernah reset jika user sudah absen hari ini di HP atau ada antrean pending
          if (pendingCount === 0 && !localHasCheckedInToday) {
            setTodayCheckIn(null);
            if (u && u.todayCheckIn) {
              const cleared = { ...u, todayCheckIn: null };
              await userStore.setCurrentUser(cleared);
              setCurrentUser(cleared);
              u = cleared;
            }
          }
        }
      }
    } catch {}

    // Sinkronkan riwayat presensi terbaru dari server
    try {
      const histRes = await attendanceApi.myHistory({ limit: 10 });
      if (histRes?.data && histRes.data.length > 0 && u) {
        const serverRecords: AttendanceRecord[] = histRes.data.map((item) => {
          const parts = item.date.split('-');
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          const dt = new Date(y, m, d);

          const dateNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          const dayName = dateNames[dt.getDay()];
          const monthName = monthNames[m] || '';

          const now = new Date();
          const isToday = now.getFullYear() === y && now.getMonth() === m && now.getDate() === d;
          const day = isToday
            ? `Hari ini, ${dayName} ${d} ${monthName} ${y}`
            : `${dayName}, ${d} ${monthName} ${y}`;

          const time = item.clockInTime.startsWith('Jam Masuk:')
            ? item.clockInTime
            : `Jam Masuk: ${item.clockInTime} WIB`;

          return {
            id: String(item.id),
            day,
            time,
            status: (item.isLate ? 'Terlambat' : 'Tepat Waktu') as 'Tepat Waktu' | 'Terlambat',
            photoUri: item.photoPath ? (getMediaUrl(item.photoPath) ?? undefined) : undefined,
          };
        });

        const onTimeCount = histRes.data.filter((a) => !a.isLate).length;
        const lateCount = histRes.data.filter((a) => a.isLate).length;

        const synced: UserAccount = {
          ...u,
          history: serverRecords.slice(0, 5),
          onTimeCount: Math.max(u.onTimeCount, onTimeCount),
          lateCount: Math.max(u.lateCount, lateCount),
        };
        await userStore.setCurrentUser(synced);
        setCurrentUser(synced);
      }
    } catch {}

    await triggerAutoSync();
  }, [triggerAutoSync]);

  // Ambil profil user dan status check-in terbaru setiap kali layar beranda aktif (fokus)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Tarik ke bawah untuk refresh (Pull-to-Refresh)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentDate(new Date());
    setCurrentTime(formatTime24(new Date()));
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Pantau jaringan: jika ada internet (Wi-Fi / kuota data), otomatis sync tanpa perlu tombol
  useEffect(() => {
    triggerAutoSync();
    const unsubscribe = syncStore.subscribeNetworkState((online) => {
      if (online) {
        triggerAutoSync();
      }
    });

    const interval = setInterval(triggerAutoSync, 15000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [triggerAutoSync]);

  // Jam digital realtime (24 jam) yang berdetak tiap detik
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentDate(now);
      setCurrentTime(formatTime24(now));
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Hitung status kehadiran otomatis:
  // - Hari Libur: Sabtu / Minggu
  // - Jika sudah absen: 'on_time' atau 'late'
  // - Jika belum absen: 'not_yet' (atau 'closed' jika kantor sudah tutup setelah jam 17.00)
  function computeStatus(date: Date, checkIn: { time: string; isLate: boolean } | null): AttendanceStatus {
    const day = date.getDay(); // 0 = Minggu, 6 = Sabtu
    if (day === 0 || day === 6) {
      return 'holiday';
    }

    if (checkIn) {
      return checkIn.isLate ? 'late' : 'on_time';
    }

    const hour = date.getHours();
    if (hour >= 17) {
      return 'closed';
    }

    return 'not_yet';
  }

  const currentStatus = computeStatus(currentDate, todayCheckIn);
  const config = STATUS_CONFIGS[currentStatus];

  // Waktu masuk yang ditampilkan di kartu
  const checkInDisplayTime = todayCheckIn
    ? `${todayCheckIn.time} WIB`
    : config.checkInTime;

  function handlePresensiPress() {
    if (todayCheckIn) {
      Alert.alert(
        'Sudah Absen Hari Ini',
        `Kamu sudah melakukan absensi masuk hari ini pada pukul ${todayCheckIn.time} WIB.`,
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/(app)/attendance');
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Konten Scrollable */}
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
            <Text style={styles.userName}>{currentUser?.fullName ?? 'Karyawan'}</Text>
            <Text style={styles.userRole}>{currentUser?.role ?? 'Karyawan'}</Text>
          </View>
          <View style={styles.clockPill}>
            <Feather name="clock" size={13} color="#047857" style={styles.clockIcon} />
            <Text style={styles.clockText}>{currentTime}</Text>
          </View>
        </View>

        {/* Hero Banner Status */}
        <View style={styles.heroWrapper}>
          <LinearGradient
            colors={config.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            {/* Lingkaran abstrak dekoratif di background */}
            <View style={styles.abstractCircle1} />
            <View style={styles.abstractCircle2} />

            <View style={styles.keteranganPill}>
              <Text style={styles.keteranganText}>
                {formatFullDateIndonesian(currentDate)}
              </Text>
            </View>
            <Text style={styles.statusTitle}>{config.title}</Text>
          </LinearGradient>

          {/* Floating Card Jam Kerja & Jam Masuk */}
          <View style={styles.floatingCard}>
            <View style={[styles.bagIconBox, { backgroundColor: config.bagBgColor }]}>
              <MaterialCommunityIcons name="bag-checked" size={26} color={config.bagIconColor} />
            </View>

            <View style={styles.officeHoursColumn}>
              <Text style={styles.cardLabel}>Jam Kerja Kantor</Text>
              <Text style={styles.cardValue}>{config.officeHours}</Text>
            </View>

            <View style={styles.checkInColumn}>
              <Text style={styles.cardLabel}>Waktu Masuk</Text>
              <View style={[styles.checkInBadge, { backgroundColor: config.checkInBg }]}>
                <Text style={[styles.checkInText, { color: config.checkInColor }]}>
                  {checkInDisplayTime}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section Rekap Bulan Ini */}
        <View style={styles.rekapSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleCaps}>REKAP BULAN INI</Text>
            <Text style={styles.rekapPeriod}>Oktober 2026</Text>
          </View>

          <View style={styles.rekapRow}>
            {/* Kartu Tepat Waktu */}
            <View style={[styles.rekapCard, styles.rekapCardOnTime]}>
              <View style={styles.rekapCardTop}>
                <Text style={[styles.rekapNumber, { color: '#0E7C86' }]}>
                  {currentUser?.onTimeCount ?? 0}
                </Text>
                <View style={[styles.badgeCircle, { backgroundColor: '#D1FAE5' }]}>
                  <Feather name="check" size={16} color="#059669" />
                </View>
              </View>
              <Text style={styles.rekapLabel}>Tepat Waktu</Text>
              <Text style={styles.rekapSubtitle}>
                {currentUser?.onTimeCount ? 'Target 95% tercapai' : 'Belum ada catatan'}
              </Text>
            </View>

            {/* Kartu Terlambat */}
            <View style={[styles.rekapCard, styles.rekapCardLate]}>
              <View style={styles.rekapCardTop}>
                <Text style={[styles.rekapNumber, { color: '#B91C1C' }]}>
                  {currentUser?.lateCount ?? 0}
                </Text>
                <View style={[styles.badgeCircle, { backgroundColor: '#FEE2E2' }]}>
                  <Feather name="alert-triangle" size={15} color="#DC2626" />
                </View>
              </View>
              <Text style={[styles.rekapLabel, { color: '#B91C1C' }]}>Terlambat</Text>
              <Text style={styles.rekapSubtitle}>
                {currentUser?.lateCount ? 'Total durasi tercatat' : 'Kedisiplinan 100%'}
              </Text>
            </View>
          </View>
        </View>

        {/* Section Presensi 5 Hari Terakhir */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.historySectionTitle}>Presensi 5 Hari Terakhir</Text>
              <Text style={styles.historySectionSub}>Catatan jam masuk hari kerja sebelumnya</Text>
            </View>
            <Pressable hitSlop={10} onPress={() => router.push('/(app)/history')}>
              <Text style={styles.seeAllText}>Semua</Text>
            </Pressable>
          </View>

          {/* List Card Presensi */}
          <View style={styles.historyList}>
            {currentUser?.history && currentUser.history.length > 0 ? (
              currentUser.history.map((item) => {
                const isOnTime = item.status === 'Tepat Waktu';
                return (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.calendarIconBox}>
                      <Feather name="calendar" size={18} color="#0E7C86" />
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDate}>{item.day}</Text>
                      <Text style={styles.historyTime}>{item.time}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        isOnTime ? styles.statusPillOnTime : styles.statusPillLate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isOnTime ? styles.statusTextOnTime : styles.statusTextLate,
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyHistoryCard}>
                <Feather name="calendar" size={24} color="#94A3B8" style={{ marginBottom: 6 }} />
                <Text style={styles.emptyHistoryTitle}>Belum Ada Riwayat Presensi</Text>
                <Text style={styles.emptyHistorySubtitle}>
                  Lakukan absensi masuk hari ini untuk mulai mencatat kehadiran kamu.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

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

        {/* Tab Tengah: Floating Tombol Kamera Presensi */}
        <View style={styles.centerFabContainer}>
          <Pressable
            accessibilityRole="button"
            onPress={handlePresensiPress}
            style={({ pressed }) => [styles.fabButton, pressed && styles.fabButtonPressed]}
          >
            <Feather name="camera" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.fabLabel}>Presensi</Text>
        </View>

        {/* Tab Profil */}
        <Pressable
          style={styles.tabButton}
          onPress={() => router.push('/(app)/profile')}
        >
          <Feather name="user" size={22} color="#05564E" />
          <Text style={styles.tabLabel}>Profil</Text>
        </Pressable>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
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
  heroWrapper: {
    marginTop: 4,
    marginBottom: 8,
  },
  heroBanner: {
    height: 165,
    borderRadius: 24,
    paddingTop: 18,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  abstractCircle1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -50,
    left: -40,
  },
  abstractCircle2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -40,
    right: -30,
  },
  keteranganPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'center',
  },
  keteranganText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  statusTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 10,
    letterSpacing: -0.5,
  },
  floatingCard: {
    marginTop: -42,
    marginHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bagIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  officeHoursColumn: {
    flex: 1,
  },
  checkInColumn: {
    alignItems: 'flex-end',
  },
  cardLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F1F24',
  },
  checkInBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  checkInText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rekapSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF2F4',
    borderRadius: 20,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleCaps: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  rekapPeriod: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0E7C86',
  },
  rekapRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rekapCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
  },
  rekapCardOnTime: {
    backgroundColor: '#F2FAF8',
  },
  rekapCardLate: {
    backgroundColor: '#FFF5F5',
  },
  rekapCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rekapNumber: {
    fontSize: 30,
    fontWeight: '700',
  },
  badgeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rekapLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F1F24',
  },
  rekapSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historySection: {
    marginTop: 24,
  },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1F24',
  },
  historySectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0E7C86',
  },
  historyList: {
    marginTop: 12,
    gap: 10,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF2F4',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  calendarIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EDF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F1F24',
  },
  historyTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillOnTime: {
    backgroundColor: '#DCFCE7',
  },
  statusPillLate: {
    backgroundColor: '#FEF3C7',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextOnTime: {
    color: '#15803D',
  },
  statusTextLate: {
    color: '#B45309',
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
    color: '#05564E',
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
    color: '#05564E',
    marginTop: 4,
  },
  syncBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  syncBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  syncIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  syncTextColumn: {
    flex: 1,
  },
  syncBannerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#92400E',
  },
  syncBannerSubtitle: {
    fontSize: 10.5,
    color: '#B45309',
    marginTop: 1,
  },
  syncButton: {
    backgroundColor: '#D97706',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  syncButtonPressed: {
    backgroundColor: '#B45309',
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF2F4',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emptyHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F1F24',
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyHistorySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});
