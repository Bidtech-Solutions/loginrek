import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { userStore, UserAccount, AttendanceRecord } from '@/lib/user-store';
import { attendanceApi, AttendanceResponse } from '@/lib/api';
import { getMediaUrl } from '@/config/env';

// Format jam digital realtime 24 jam
function formatTime24(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} WIB`;
}

// Helper nama hari standar Indonesia
export const DAYS_OF_WEEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function getIndonesianDayName(dayOfWeek: number): string {
  const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return names[dayOfWeek] || '';
}

// Ekstrak angka tanggal dari teks riwayat (contoh: "Rab, 14 Okt 2026" atau "Hari ini, Rab 28 Okt 2026")
export function extractDayNumber(dayStr: string): number | null {
  const match = dayStr.match(/\b(\d{1,2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

export interface ActivityItem {
  id: string;
  day: string;
  time: string;
  status: string;
  type: 'late' | 'on_time' | 'absent' | 'rejected';
  photoUri?: string;
}

export interface MonthConfig {
  id: string;
  name: string;
  shortName: string;
  hasData: boolean;
  hadir: number;
  terlambat: number;
  tidakHadir: number;
  isCurrent?: boolean;
  activities: ActivityItem[];
}

// Koleksi data lengkap 12 bulan (Januari s/d Desember 2026) - Bersih tanpa data dummy untuk persiapan demo
const MONTHS_DATA: MonthConfig[] = [
  { id: '2026-01', name: 'Januari 2026', shortName: 'Januari', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-02', name: 'Februari 2026', shortName: 'Februari', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-03', name: 'Maret 2026', shortName: 'Maret', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-04', name: 'April 2026', shortName: 'April', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-05', name: 'Mei 2026', shortName: 'Mei', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-06', name: 'Juni 2026', shortName: 'Juni', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-07', name: 'Juli 2026', shortName: 'Juli', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-08', name: 'Agustus 2026', shortName: 'Agustus', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-09', name: 'September 2026', shortName: 'September', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-10', name: 'Oktober 2026', shortName: 'Oktober', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, isCurrent: true, activities: [] },
  { id: '2026-11', name: 'November 2026', shortName: 'November', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
  { id: '2026-12', name: 'Desember 2026', shortName: 'Desember', hasData: false, hadir: 0, terlambat: 0, tidakHadir: 0, activities: [] },
];

const currentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const INITIAL_INDEX = Math.max(0, Math.min(11, new Date().getMonth()));

// Helper memformat presensi dari backend API ke format tampilan riwayat
function formatApiAttendance(att: AttendanceResponse): { item: ActivityItem; monthId: string; dayNum: number } {
  const parts = att.date.split('-');
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

  const timeFormatted = att.clockInTime.startsWith('Jam Masuk:')
    ? att.clockInTime
    : `Jam Masuk: ${att.clockInTime} WIB`;

  return {
    item: {
      id: `server-${att.id}`,
      day,
      time: timeFormatted,
      status: att.status || (att.isLate ? 'Terlambat' : 'Tepat Waktu'),
      type: att.isLate ? 'late' : 'on_time',
      photoUri: att.photoPath ? (getMediaUrl(att.photoPath) ?? undefined) : undefined,
    },
    monthId: `${parts[0]}-${parts[1]}`,
    dayNum: d,
  };
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentTime, setCurrentTime] = useState(() => formatTime24(new Date()));
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(INITIAL_INDEX);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<number | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<ActivityItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [serverHistory, setServerHistory] = useState<AttendanceResponse[]>([]);

  const loadUser = useCallback(async () => {
    let u = await userStore.getCurrentUser();
    if (!u) {
      router.replace('/(auth)/login');
      return;
    }

    // 1. Ambil seluruh riwayat presensi user dari server (terisolasi per akun)
    try {
      const historyRes = await attendanceApi.myHistory({ all: true });
      if (historyRes?.data) {
        setServerHistory(historyRes.data);

        if (historyRes.data.length > 0) {
          const recentRecords: AttendanceRecord[] = historyRes.data.slice(0, 5).map((att) => {
            const formatted = formatApiAttendance(att);
            return {
              id: String(att.id),
              day: formatted.item.day,
              time: formatted.item.time,
              status: (att.isLate ? 'Terlambat' : 'Tepat Waktu') as 'Tepat Waktu' | 'Terlambat',
              photoUri: formatted.item.photoUri,
            };
          });

          const onTimeCount = historyRes.data.filter((a) => !a.isLate).length;
          const lateCount = historyRes.data.filter((a) => a.isLate).length;

          u = {
            ...u,
            history: recentRecords,
            onTimeCount,
            lateCount,
          };
          await userStore.setCurrentUser(u);
        }
      }
    } catch {}

    // 2. Ambil status presensi hari ini
    try {
      const res = await attendanceApi.getToday();
      if (res?.data?.hasAttended && res.data.attendance) {
        const att = res.data.attendance;
        const currentHistory = u.history || [];
        const alreadyInHistory = currentHistory.some(
          (h) => h.time.includes(att.clockInTime) || (h.id && h.id === String(att.id))
        );

        let updatedHistory = currentHistory;
        if (!alreadyInHistory) {
          const formatted = formatApiAttendance(att);
          const newRecord: AttendanceRecord = {
            id: String(att.id || Date.now()),
            day: formatted.item.day,
            time: formatted.item.time,
            status: att.isLate ? 'Terlambat' : 'Tepat Waktu',
            photoUri: att.photoPath ? (getMediaUrl(att.photoPath) ?? undefined) : undefined,
          };
          updatedHistory = [newRecord, ...currentHistory.slice(0, 4)];
        }

        u = {
          ...u,
          todayCheckIn: {
            date: res.data.today,
            time: att.clockInTime,
            isLate: att.isLate,
            photoUri: att.photoPath ? (getMediaUrl(att.photoPath) ?? undefined) : u.todayCheckIn?.photoUri,
          },
          history: updatedHistory,
          onTimeCount: !att.isLate ? Math.max(u.onTimeCount, 1) : u.onTimeCount,
          lateCount: att.isLate ? Math.max(u.lateCount, 1) : u.lateCount,
        };
        await userStore.setCurrentUser(u);
      }
    } catch {}

    setCurrentUser(u);
  }, []);

  // Ambil user yang sedang aktif login setiap kali halaman riwayat aktif
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

  const currentMonth = MONTHS_DATA[selectedMonthIdx];
  const isCurrentMonth = currentMonth.id === currentYearMonth;

  // Filter aktivitas presensi untuk bulan yang sedang dipilih
  const currentMonthServerActivities = useMemo(() => {
    return serverHistory
      .filter((att) => att.date.startsWith(currentMonth.id))
      .map((att) => formatApiAttendance(att).item);
  }, [serverHistory, currentMonth.id]);

  const hasUserHistory = Boolean(isCurrentMonth && currentUser?.history && currentUser.history.length > 0);
  const hasData = currentMonth.hasData || currentMonthServerActivities.length > 0 || hasUserHistory;
  const todayDate = new Date().getDate();

  // Navigasi bulan
  function handlePrevMonth() {
    if (selectedMonthIdx > 0) {
      setSelectedMonthIdx((prev) => prev - 1);
      setSelectedDateFilter(null);
    }
  }

  function handleNextMonth() {
    if (selectedMonthIdx < MONTHS_DATA.length - 1) {
      setSelectedMonthIdx((prev) => prev + 1);
      setSelectedDateFilter(null);
    }
  }

  // Pilih bulan langsung dari modal
  function handleSelectMonth(idx: number) {
    setSelectedMonthIdx(idx);
    setSelectedDateFilter(null);
    setShowMonthPicker(false);
  }

  // Rekap angka kehadiran
  const hadirCount = currentMonthServerActivities.length > 0
    ? currentMonthServerActivities.filter((a) => a.type === 'on_time').length
    : hasData
      ? isCurrentMonth && currentUser
        ? currentUser.onTimeCount
        : currentMonth.hadir
      : 0;

  const terlambatCount = currentMonthServerActivities.length > 0
    ? currentMonthServerActivities.filter((a) => a.type === 'late').length
    : hasData
      ? isCurrentMonth && currentUser
        ? currentUser.lateCount
        : currentMonth.terlambat
      : 0;

  const tidakHadirCount = hasData ? currentMonth.tidakHadir : 0;

  // Gabungkan aktivitas presensi dinamis bila user baru saja melakukan presensi
  const activitiesToDisplay: ActivityItem[] =
    currentMonthServerActivities.length > 0
      ? currentMonthServerActivities
      : isCurrentMonth && currentUser?.history && currentUser.history.length > 0
        ? [
            ...currentUser.history.map((h) => ({
              id: `user-${h.id}`,
              day: h.day,
              time: h.time.startsWith('Jam Masuk:') ? h.time : `Jam Masuk: ${h.time}`,
              status: h.status,
              type: (h.status === 'Tepat Waktu' ? 'on_time' : 'late') as 'on_time' | 'late',
              photoUri:
                h.photoUri ||
                (h.day.includes('Hari ini') ? currentUser.todayCheckIn?.photoUri : undefined),
            })),
            ...currentMonth.activities.filter(
              (act) => !currentUser.history.some((h) => h.day === act.day)
            ),
          ]
        : currentMonth.activities;

  // Map aktivitas ke nomor tanggal (1..31) untuk ditampilkan pada kalender
  const attendanceMap = useMemo(() => {
    const map: Record<number, ActivityItem> = {};
    for (const act of activitiesToDisplay) {
      const d = extractDayNumber(act.day);
      if (d !== null) {
        map[d] = act;
      }
    }
    return map;
  }, [activitiesToDisplay]);

  // Kalkulasi grid 7-kolom kalender untuk bulan yang dipilih di tahun 2026
  const { calendarCells } = useMemo(() => {
    const firstDay = new Date(2026, selectedMonthIdx, 1).getDay();
    const totalDays = new Date(2026, selectedMonthIdx + 1, 0).getDate();
    const cells: ({ type: 'empty'; key: string } | { type: 'day'; dayNum: number; key: string })[] = [];

    // Kotak kosong sebelum tanggal 1
    for (let i = 0; i < firstDay; i++) {
      cells.push({ type: 'empty', key: `empty-pre-${i}` });
    }
    // Tanggal 1 sampai akhir bulan
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ type: 'day', dayNum: d, key: `day-${d}` });
    }
    // Kotak kosong pelengkap kelipatan 7
    const rem = cells.length % 7;
    if (rem > 0) {
      for (let i = 0; i < 7 - rem; i++) {
        cells.push({ type: 'empty', key: `empty-post-${i}` });
      }
    }
    return { calendarCells: cells };
  }, [selectedMonthIdx]);

  // Filter aktivitas berdasarkan tanggal jika ada tanggal yang dipilih
  const filteredActivities = useMemo(() => {
    if (selectedDateFilter === null) return activitiesToDisplay;
    return activitiesToDisplay.filter((act) => extractDayNumber(act.day) === selectedDateFilter);
  }, [activitiesToDisplay, selectedDateFilter]);

  // Render badge pill dengan warna yang sesuai tipe status
  function renderStatusPill(status: string, type?: string) {
    let pillStyle = styles.pillOnTime;
    let textStyle = styles.pillTextOnTime;

    if (type === 'late' || status.toLowerCase().includes('terlambat')) {
      pillStyle = styles.pillLate;
      textStyle = styles.pillTextLate;
    } else if (type === 'absent' || status.toLowerCase().includes('tidak absen')) {
      pillStyle = styles.pillAbsent;
      textStyle = styles.pillTextAbsent;
    } else if (type === 'rejected' || status.toLowerCase().includes('ditolak')) {
      pillStyle = styles.pillRejected;
      textStyle = styles.pillTextRejected;
    }

    return (
      <View style={[styles.statusPill, pillStyle]}>
        <Text style={[styles.statusPillText, textStyle]} numberOfLines={1}>
          {status}
        </Text>
      </View>
    );
  }

  // Tampilan Detail Presensi (Mirip tampilan preview setelah jepret foto, tanpa tombol kirim/foto ulang)
  if (selectedDetailItem) {
    const timeMatch = selectedDetailItem.time.match(/(\d{1,2}[.:]\d{2})/);
    const displayTime = timeMatch ? timeMatch[1].replace(':', '.') : '08.00';
    const isLate =
      selectedDetailItem.type === 'late' ||
      selectedDetailItem.status.toLowerCase().includes('terlambat');
    const isAbsent =
      selectedDetailItem.type === 'absent' ||
      selectedDetailItem.status.toLowerCase().includes('tidak absen') ||
      selectedDetailItem.status.toLowerCase().includes('ditolak');

    const targetPhotoUri =
      (selectedDetailItem.photoUri && selectedDetailItem.photoUri !== 'fallback'
        ? selectedDetailItem.photoUri
        : undefined) ||
      (selectedDetailItem.day.includes('Hari ini') ||
       selectedDetailItem.day.includes(String(todayDate)) ||
       selectedDetailItem.id.startsWith('user-') ||
       selectedDetailItem.id.startsWith('okt-28')
        ? currentUser?.todayCheckIn?.photoUri && currentUser.todayCheckIn.photoUri !== 'fallback'
          ? currentUser.todayCheckIn.photoUri
          : undefined
        : undefined) ||
      currentUser?.avatarUrl;

    const photoSource =
      targetPhotoUri
        ? { uri: targetPhotoUri }
        : require('@/assets/default_avatar.png');

    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />

        {/* Top Header Bersih: Nama, Role, & Jam Digital */}
        <View style={[styles.detailTopHeader, { paddingTop: insets.top + 10 }]}>
          <View>
            <Text style={styles.userName}>{currentUser?.fullName ?? 'Karyawan'}</Text>
            <Text style={styles.userRole}>{currentUser?.role ?? 'Karyawan'}</Text>
          </View>
          <View style={styles.clockPill}>
            <Feather name="clock" size={13} color="#047857" style={styles.clockIcon} />
            <Text style={styles.clockText}>{currentTime}</Text>
          </View>
        </View>

        {/* Konten Scroll: Foto Bukti, Waktu, Status */}
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={[
            styles.detailScrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 34) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Foto Presensi Selfie dengan Tombol Kembali di Kiri Atas Foto */}
          <View style={styles.previewPhotoCard}>
            <Image
              source={photoSource}
              style={styles.previewPhotoImage}
              resizeMode="cover"
            />

            {/* Tombol Kembali Menimpa di Kiri Atas Foto */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali ke Halaman Riwayat"
              onPress={() => setSelectedDetailItem(null)}
              style={({ pressed }) => [
                styles.photoOverlayBackBtn,
                pressed && styles.photoOverlayBackBtnPressed,
              ]}
              hitSlop={8}
            >
              <Feather name="chevron-left" size={22} color="#0F1F24" />
            </Pressable>
          </View>

          {/* Card Waktu Absen Tercatat */}
          <View style={styles.previewCard}>
            <View style={styles.clockIconBox}>
              <Feather name="clock" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.previewCardInfo}>
              <Text style={styles.previewCardHeaderTitle}>WAKTU ABSEN TERCATAT</Text>
              <View style={styles.previewTimeValueRow}>
                <Text style={styles.previewTimeValueText}>{displayTime}</Text>
                <Text style={styles.previewTimeWibText}>WIB</Text>
              </View>
              <Text style={styles.previewDateSubtitle}>{selectedDetailItem.day}</Text>
            </View>
          </View>

          {/* Card Status Kehadiran */}
          <View style={styles.previewStatusCard}>
            <Text style={styles.previewCardHeaderTitle}>STATUS KEHADIRAN</Text>
            <View
              style={[
                styles.statusBadgePill,
                isLate
                  ? styles.statusBadgePillLate
                  : isAbsent
                  ? styles.statusBadgePillAbsent
                  : styles.statusBadgePillOnTime,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgePillText,
                  isLate
                    ? styles.statusBadgeTextLate
                    : isAbsent
                    ? styles.statusBadgeTextAbsent
                    : styles.statusBadgeTextOnTime,
                ]}
              >
                {selectedDetailItem.status}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

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
        {/* Top Header: Profil & Jam Realtime */}
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

        {/* Month Selector Card (Klik tengah untuk buka kalender presensi) */}
        <View style={styles.monthSelectorCard}>
          <Pressable
            onPress={handlePrevMonth}
            disabled={selectedMonthIdx === 0}
            style={({ pressed }) => [
              styles.monthNavBtn,
              selectedMonthIdx === 0 && styles.monthNavBtnDisabled,
              pressed && styles.monthNavBtnPressed,
            ]}
            hitSlop={8}
            accessibilityLabel="Bulan sebelumnya"
          >
            <Feather
              name="chevron-left"
              size={18}
              color={selectedMonthIdx === 0 ? '#CBD5E1' : '#0F1F24'}
            />
          </Pressable>

          <Pressable
            onPress={() => setShowMonthPicker(true)}
            style={({ pressed }) => [
              styles.monthLabelBox,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={6}
            accessibilityLabel="Buka Kalender Presensi"
          >
            <Feather name="calendar" size={18} color="#0E7C86" style={styles.calendarIcon} />
            <Text style={styles.monthLabelText}>{currentMonth.name}</Text>
            <Feather name="chevron-down" size={14} color="#64748B" style={{ marginLeft: 6 }} />
          </Pressable>

          <Pressable
            onPress={handleNextMonth}
            disabled={selectedMonthIdx === MONTHS_DATA.length - 1}
            style={({ pressed }) => [
              styles.monthNavBtn,
              selectedMonthIdx === MONTHS_DATA.length - 1 && styles.monthNavBtnDisabled,
              pressed && styles.monthNavBtnPressed,
            ]}
            hitSlop={8}
            accessibilityLabel="Bulan berikutnya"
          >
            <Feather
              name="chevron-right"
              size={18}
              color={selectedMonthIdx === MONTHS_DATA.length - 1 ? '#CBD5E1' : '#0F1F24'}
            />
          </Pressable>
        </View>

        {/* Banner Filter Tanggal Aktif jika user memilih tanggal di kalender */}
        {selectedDateFilter !== null && (
          <View style={styles.filterActiveBanner}>
            <View style={styles.filterActiveLeft}>
              <Feather name="filter" size={13} color="#05564E" style={{ marginRight: 6 }} />
              <Text style={styles.filterActiveText}>
                Filter tanggal:{' '}
                <Text style={styles.filterActiveBold}>
                  {selectedDateFilter} {currentMonth.shortName} 2026
                </Text>
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedDateFilter(null)}
              style={styles.filterClearBtn}
              hitSlop={8}
              accessibilityLabel="Hapus filter tanggal"
            >
              <Text style={styles.filterClearText}>Tampilkan Semua</Text>
              <Feather name="x" size={12} color="#05564E" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        )}

        {/* 3 Summary Cards: Hadir, Terlambat, Tidak Hadir */}
        <View style={styles.summaryRow}>
          {hasData ? (
            <>
              {/* Card Hadir (Aktif) */}
              <View style={[styles.summaryCard, styles.summaryCardHadir]}>
                <View style={styles.summaryHeader}>
                  <View style={[styles.summaryIconBadge, { backgroundColor: '#A7F3D0' }]}>
                    <Feather name="check" size={10} color="#047857" />
                  </View>
                  <Text
                    style={[styles.summaryLabel, { color: '#047857' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Hadir
                  </Text>
                </View>
                <Text style={[styles.summaryNumber, { color: '#047857' }]}>{hadirCount}</Text>
              </View>

              {/* Card Terlambat (Aktif) */}
              <View style={[styles.summaryCard, styles.summaryCardTerlambat]}>
                <View style={styles.summaryHeader}>
                  <View style={[styles.summaryIconBadge, { backgroundColor: '#E2E8F0' }]}>
                    <Feather name="clock" size={10} color="#475569" />
                  </View>
                  <Text
                    style={[styles.summaryLabel, { color: '#475569' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Terlambat
                  </Text>
                </View>
                <Text style={[styles.summaryNumber, { color: '#0F1F24' }]}>{terlambatCount}</Text>
              </View>

              {/* Card Tidak Hadir (Aktif) */}
              <View style={[styles.summaryCard, styles.summaryCardTidakHadir]}>
                <View style={styles.summaryHeader}>
                  <View style={[styles.summaryIconBadge, { backgroundColor: '#FECACA' }]}>
                    <Feather name="log-out" size={10} color="#DC2626" />
                  </View>
                  <Text
                    style={[styles.summaryLabel, { color: '#DC2626' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Tidak hadir
                  </Text>
                </View>
                <Text style={[styles.summaryNumber, { color: '#DC2626' }]}>{tidakHadirCount}</Text>
              </View>
            </>
          ) : (
            <>
              {/* Card Hadir (Kosong) */}
              <View style={[styles.summaryCard, styles.summaryCardEmpty]}>
                <Text style={styles.summaryEmptyLabel}>Hadir</Text>
                <Text style={styles.summaryEmptyNumber}>0</Text>
              </View>

              {/* Card Terlambat (Kosong) */}
              <View style={[styles.summaryCard, styles.summaryCardEmpty]}>
                <Text style={styles.summaryEmptyLabel}>Terlambat</Text>
                <Text style={styles.summaryEmptyNumber}>0</Text>
              </View>

              {/* Card Tidak Hadir (Kosong) */}
              <View style={[styles.summaryCard, styles.summaryCardEmpty]}>
                <Text style={styles.summaryEmptyLabel}>Tidak Hadir</Text>
                <Text style={styles.summaryEmptyNumber}>0</Text>
              </View>
            </>
          )}
        </View>

        {/* Kondisi 1: Bulan Ada Data */}
        {hasData ? (
          <View style={styles.activitySection}>
            <View style={styles.activityHeaderRow}>
              <Text style={styles.activityTitle}>Aktivitas Presensi</Text>
              {selectedDateFilter !== null && (
                <Text style={styles.activityCountBadge}>
                  {filteredActivities.length} Riwayat
                </Text>
              )}
            </View>

            {filteredActivities.length > 0 ? (
              <View style={styles.activityList}>
                {filteredActivities.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedDetailItem(item)}
                    style={({ pressed }) => [
                      styles.activityCard,
                      pressed && styles.activityCardPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Detail presensi ${item.day}`}
                  >
                    <View style={styles.calendarIconBox}>
                      <Feather name="calendar" size={18} color="#0E7C86" />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityDate}>{item.day}</Text>
                      <Text style={styles.activityTime}>{item.time}</Text>
                    </View>
                    {renderStatusPill(item.status, item.type)}
                    <Feather name="chevron-right" size={16} color="#94A3B8" style={{ marginLeft: 6 }} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.noFilterResultsCard}>
                <Feather name="calendar" size={26} color="#94A3B8" style={{ marginBottom: 8 }} />
                <Text style={styles.noFilterResultsText}>
                  Tidak ada catatan presensi pada tanggal {selectedDateFilter} {currentMonth.shortName} 2026.
                </Text>
                <Pressable
                  onPress={() => setSelectedDateFilter(null)}
                  style={styles.resetFilterBtn}
                >
                  <Text style={styles.resetFilterBtnText}>Tampilkan Semua Hari</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          /* Kondisi 2: Bulan Belum Ada Absen (Empty State) */
          <View style={styles.emptyCard}>
            {/* Ilustrasi Lingkaran Kalender Bertingkat */}
            <View style={styles.emptyCircleOuter}>
              <View style={styles.emptyCircleInner}>
                <Feather name="calendar" size={38} color="#0E7C86" />
              </View>
              <View style={styles.emptyClockBadge}>
                <Feather name="clock" size={14} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.emptyTitle}>Belum ada absensi bulan ini.</Text>
            <Text style={styles.emptySubtitle}>
              Catatan kehadiran kamu untuk periode ini akan otomatis muncul setelah kamu melakukan presensi masuk pertama.
            </Text>

            {/* Tombol Lihat Bulan Sebelumnya */}
            <Pressable
              onPress={() => setSelectedMonthIdx(INITIAL_INDEX)}
              style={({ pressed }) => [
                styles.prevMonthBtn,
                pressed && styles.prevMonthBtnPressed,
              ]}
            >
              <Feather name="rotate-ccw" size={16} color="#047857" style={{ marginRight: 8 }} />
              <Text style={styles.prevMonthBtnText}>Lihat Bulan Sebelumnya</Text>
            </Pressable>

            {/* Tombol Kembali ke Beranda */}
            <Pressable
              onPress={() => router.replace('/(app)/home')}
              style={({ pressed }) => [
                styles.backHomeBtn,
                pressed && styles.backHomeBtnPressed,
              ]}
            >
              <Feather name="arrow-left" size={16} color="#0E7C86" style={{ marginRight: 8 }} />
              <Text style={styles.backHomeBtnText}>Kembali ke Beranda</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* Tab Riwayat (Aktif) */}
        <Pressable style={styles.tabButton} onPress={() => {}}>
          <Feather name="rotate-ccw" size={22} color="#05564E" />
          <Text style={[styles.tabLabel, { color: '#05564E', fontWeight: '700' }]}>Riwayat</Text>
        </Pressable>

        {/* Tab Tengah: Floating Tombol Beranda */}
        <View style={styles.centerFabContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Beranda"
            onPress={() => router.replace('/(app)/home')}
            style={({ pressed }) => [styles.fabButton, pressed && styles.fabButtonPressed]}
          >
            <Feather name="home" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.fabLabel, { color: '#64748B' }]}>Beranda</Text>
        </View>

        {/* Tab Profil */}
        <Pressable style={styles.tabButton} onPress={() => router.push('/(app)/profile')}>
          <Feather name="user" size={22} color="#64748B" />
          <Text style={[styles.tabLabel, { color: '#64748B' }]}>Profil</Text>
        </Pressable>
      </View>

      {/* Modal Kalender Sederhana & Bersih (Pure Calendar Only) */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowMonthPicker(false)}
          />
          <View style={styles.cleanCalendarCard}>
            {/* Header: Navigasi Bulan & Tombol Tutup */}
            <View style={styles.cleanCalendarHeader}>
              <Pressable
                onPress={handlePrevMonth}
                disabled={selectedMonthIdx === 0}
                style={({ pressed }) => [
                  styles.cleanNavBtn,
                  selectedMonthIdx === 0 && styles.cleanNavBtnDisabled,
                  pressed && styles.cleanNavBtnPressed,
                ]}
                hitSlop={8}
                accessibilityLabel="Bulan sebelumnya"
              >
                <Feather
                  name="chevron-left"
                  size={20}
                  color={selectedMonthIdx === 0 ? '#CBD5E1' : '#0F1F24'}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  setSelectedDateFilter(null);
                  setShowMonthPicker(false);
                }}
                hitSlop={6}
                accessibilityLabel="Pilih bulan ini"
              >
                <Text style={styles.cleanMonthTitleText}>{currentMonth.name}</Text>
              </Pressable>

              <Pressable
                onPress={handleNextMonth}
                disabled={selectedMonthIdx === MONTHS_DATA.length - 1}
                style={({ pressed }) => [
                  styles.cleanNavBtn,
                  selectedMonthIdx === MONTHS_DATA.length - 1 && styles.cleanNavBtnDisabled,
                  pressed && styles.cleanNavBtnPressed,
                ]}
                hitSlop={8}
                accessibilityLabel="Bulan berikutnya"
              >
                <Feather
                  name="chevron-right"
                  size={20}
                  color={selectedMonthIdx === MONTHS_DATA.length - 1 ? '#CBD5E1' : '#0F1F24'}
                />
              </Pressable>

              <Pressable
                onPress={() => setShowMonthPicker(false)}
                style={styles.cleanCloseBtn}
                hitSlop={10}
                accessibilityLabel="Tutup kalender"
              >
                <Feather name="x" size={18} color="#64748B" />
              </Pressable>
            </View>

            {/* Baris Nama Hari: Min, Sen, Sel, Rab, Kam, Jum, Sab */}
            <View style={styles.cleanWeekRow}>
              {DAYS_OF_WEEK.map((d, i) => (
                <View key={d} style={styles.cleanWeekCell}>
                  <Text
                    style={[
                      styles.cleanWeekText,
                      i === 0 && styles.cleanWeekTextSunday,
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>

            {/* Grid Tanggal 1 s/d Akhir Bulan */}
            <View style={styles.cleanDaysGrid}>
              {calendarCells.map((cell) => {
                if (cell.type === 'empty') {
                  return <View key={cell.key} style={styles.cleanDayCellEmpty} />;
                }

                const dayNum = cell.dayNum;
                const activity = attendanceMap[dayNum];
                const isSelected = selectedDateFilter === dayNum;
                const isToday = isCurrentMonth && dayNum === todayDate;
                const isSunday = new Date(2026, selectedMonthIdx, dayNum).getDay() === 0;

                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => {
                      // Ketuk tanggal: pilih tanggal dan langsung tutup popup
                      if (selectedDateFilter === dayNum) {
                        setSelectedDateFilter(null);
                      } else {
                        setSelectedDateFilter(dayNum);
                      }
                      setShowMonthPicker(false);
                    }}
                    style={styles.cleanDayCell}
                    hitSlop={2}
                    accessibilityLabel={`Tanggal ${dayNum}`}
                  >
                    <View
                      style={[
                        styles.cleanDayCircle,
                        isToday && !isSelected && styles.cleanDayCircleToday,
                        isSelected && styles.cleanDayCircleSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cleanDayText,
                          isSunday && !isSelected && styles.cleanDayTextSunday,
                          isToday && !isSelected && styles.cleanDayTextToday,
                          isSelected && styles.cleanDayTextSelected,
                        ]}
                      >
                        {dayNum}
                      </Text>
                    </View>

                    {/* Titik kecil status presensi */}
                    <View style={styles.cleanDotBox}>
                      {activity ? (
                        <View
                          style={[
                            styles.cleanDot,
                            activity.type === 'on_time' && styles.cleanDotOnTime,
                            activity.type === 'late' && styles.cleanDotLate,
                            (activity.type === 'absent' || activity.type === 'rejected') &&
                              styles.cleanDotAbsent,
                          ]}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Keterangan Titik Presensi (Legend) */}
            <View style={styles.cleanLegendRow}>
              <View style={styles.cleanLegendItem}>
                <View style={[styles.cleanLegendDot, styles.cleanDotOnTime]} />
                <Text style={styles.cleanLegendText}>Tepat Waktu</Text>
              </View>
              <View style={styles.cleanLegendItem}>
                <View style={[styles.cleanLegendDot, styles.cleanDotLate]} />
                <Text style={styles.cleanLegendText}>Terlambat</Text>
              </View>
              <View style={styles.cleanLegendItem}>
                <View style={[styles.cleanLegendDot, styles.cleanDotAbsent]} />
                <Text style={styles.cleanLegendText}>Tidak Hadir</Text>
              </View>
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
  monthSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF2F4',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: {
    opacity: 0.35,
  },
  monthNavBtnPressed: {
    backgroundColor: '#EDF2F7',
  },
  monthLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calendarIcon: {
    marginRight: 8,
  },
  monthLabelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1F24',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  summaryCardHadir: {
    backgroundColor: '#E6F9F5',
    borderColor: '#CCFBF1',
  },
  summaryCardTerlambat: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  summaryCardTidakHadir: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FEE2E2',
  },
  summaryCardEmpty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EDF2F4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryEmptyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryEmptyNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F1F24',
    textAlign: 'center',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    maxWidth: '100%',
    paddingHorizontal: 2,
  },
  summaryIconBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    flexShrink: 0,
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterActiveBanner: {
    backgroundColor: '#EDF7F6',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterActiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterActiveText: {
    fontSize: 12,
    color: '#0F1F24',
  },
  filterActiveBold: {
    fontWeight: '700',
    color: '#05564E',
  },
  filterClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterClearText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  activitySection: {
    marginTop: 4,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F1F24',
  },
  activityCountBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#05564E',
    backgroundColor: '#E6F9F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  noFilterResultsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF2F4',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFilterResultsText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  resetFilterBtn: {
    backgroundColor: '#E6F9F5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  activityList: {
    gap: 10,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF2F4',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  calendarIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
    marginRight: 8,
  },
  activityDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F1F24',
  },
  activityTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'center',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  pillOnTime: {
    backgroundColor: '#E6F9F5',
  },
  pillTextOnTime: {
    color: '#0D9488',
  },
  pillLate: {
    backgroundColor: '#FEF3C7',
  },
  pillTextLate: {
    color: '#B45309',
  },
  pillAbsent: {
    backgroundColor: '#FEE2E2',
  },
  pillTextAbsent: {
    color: '#DC2626',
  },
  pillRejected: {
    backgroundColor: '#FEE2E2',
  },
  pillTextRejected: {
    color: '#DC2626',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF2F4',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginTop: 8,
  },
  emptyCircleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E6F7F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 10,
    marginBottom: 20,
  },
  emptyCircleInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#D1F4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyClockBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0E7C86',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F1F24',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  prevMonthBtn: {
    backgroundColor: '#CCFBF1',
    borderRadius: 14,
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  prevMonthBtnPressed: {
    backgroundColor: '#99F6E4',
    transform: [{ scale: 0.99 }],
  },
  prevMonthBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  backHomeBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backHomeBtnPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.99 }],
  },
  backHomeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0E7C86',
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cleanCalendarCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  cleanCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  cleanNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanNavBtnDisabled: {
    opacity: 0.3,
  },
  cleanNavBtnPressed: {
    backgroundColor: '#EDF2F7',
  },
  cleanMonthTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F1F24',
  },
  cleanCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanWeekRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cleanWeekCell: {
    flex: 1,
    alignItems: 'center',
  },
  cleanWeekText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  cleanWeekTextSunday: {
    color: '#EF4444',
  },
  cleanDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cleanDayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 3,
  },
  cleanDayCellEmpty: {
    width: '14.28%',
    height: 40,
  },
  cleanDayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cleanDayCircleToday: {
    borderWidth: 1.5,
    borderColor: '#0E7C86',
  },
  cleanDayCircleSelected: {
    backgroundColor: '#0E7C86',
    shadowColor: '#0E7C86',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  cleanDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  cleanDayTextSunday: {
    color: '#EF4444',
  },
  cleanDayTextToday: {
    color: '#0E7C86',
    fontWeight: '700',
  },
  cleanDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cleanDotBox: {
    height: 5,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  cleanDotOnTime: {
    backgroundColor: '#10B981',
  },
  cleanDotLate: {
    backgroundColor: '#F59E0B',
  },
  cleanDotAbsent: {
    backgroundColor: '#EF4444',
  },
  cleanLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cleanLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cleanLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cleanLegendText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  detailTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeftWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerBackBtnPressed: {
    backgroundColor: '#E2E8F0',
  },
  detailScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  detailScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  previewPhotoCard: {
    width: '100%',
    height: 360,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0F1F24',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  photoOverlayBackBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  photoOverlayBackBtnPressed: {
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
    transform: [{ scale: 0.94 }],
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
  previewDateSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
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
  statusBadgePillOnTime: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgePillLate: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgePillAbsent: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusBadgePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeTextOnTime: {
    color: '#047857',
  },
  statusBadgeTextLate: {
    color: '#B45309',
  },
  statusBadgeTextAbsent: {
    color: '#DC2626',
  },
  previewLocationCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EDF2F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  locationIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E6F9F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  previewLocationName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1F24',
    marginTop: 2,
  },
  previewLocationDesc: {
    fontSize: 11.5,
    color: '#0E7C86',
    fontWeight: '500',
    marginTop: 2,
  },
  backToHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F9F5',
    borderWidth: 1,
    borderColor: '#B9F0E5',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
    marginBottom: 10,
  },
  backToHistoryBtnPressed: {
    backgroundColor: '#C8F3EA',
  },
  backToHistoryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#05564E',
  },
  activityCardPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    transform: [{ scale: 0.99 }],
  },
});
