# Design — loginrek

Satu sistem desain untuk dashboard (admin/HR, desktop) dan mobile (karyawan).

## Brand

- Nama: **loginrek** (huruf kecil di logo & judul).
- Warna utama: **biru kehijauan (teal)**. Logo sementara; ganti dengan aset final.
- Bahasa UI: Indonesia. Tanggal `22 Okt 2026` / `Kamis, 22 Okt 2026`, jam `08:05 WIB`.

## Token warna

Mobile: `loginrek-mobile/src/theme/colors.ts`. Dashboard: `loginrek-dashboard/src/index.css`.
Kedua klien memakai nilai yang sama.

| Token | Nilai | Pemakaian |
| ----- | ----- | --------- |
| `primary` (`--brand`) | `#0E7C86` (dark: `#2BB3BD`) | aksi utama, link/ikon aktif, logo |
| `primaryDark` | `#0A5E66` | hover / pressed |
| `primaryLight` | `#E6F4F5` | latar badge, seleksi, kartu status |
| `accent` | `#14B8A6` | highlight sekunder |
| `background` | `#F7FAFA` (dashboard `#F5F5F6`) | latar halaman |
| `surface` | `#FFFFFF` | kartu, tabel |
| `text` / `textMuted` | `#0F1F24` / `#5B6B70` | teks |
| `success` / `warning` / `danger` | `#16A34A` / `#D97706` / `#DC2626` | hadir / terlambat / gagal |

Status kehadiran ditampilkan dengan **teks + warna**, jangan warna saja:
Hadir/Tepat Waktu hijau, Terlambat oranye, Tidak hadir merah.

Spasi: `xs 4, sm 8, md 12, lg 16, xl 24, xxl 32`. Radius: `sm 6, md 10, lg 16, full`.

## Dashboard (web)

- Min. lebar 1280px, tetap responsif sampai tablet. Tema terang default.
- Menu: Ringkasan, Kehadiran, Karyawan, Pengaturan (rencana: Jadwal & Shift, Izin/Cuti, Lokasi Kantor).
- **Tabel data**: filter di atas, pagination di bawah, aksi baris di kanan; ekspor CSV/Excel untuk rekap.
- **Form**: label di atas field, pesan error di bawah field.
- Aksi destruktif memakai konfirmasi modal.
- Angka di tabel: `font-variant-numeric: tabular-nums`. Font sistem, dasar 15px.

## Mobile

Cepat dibuka, satu tujuan utama (absen), bisa dipakai satu tangan.

- **Tombol absen** besar di area jempol, tinggi ≥ 56, label jelas ("Absen Masuk") + jam saat ini.
- Kartu status hari ini di atas: jam masuk, status (teks + warna).
- Feedback langsung setelah absen: layar sukses (jam & lokasi kantor) atau pesan error yang
  menjelaskan tindakan (mis. "Kamu di luar radius kantor (230 m)").
- Target sentuh ≥ 44×44, font dasar 16, dukung font scaling sistem.
- Hormati safe area (`react-native-safe-area-context`).
- Navigasi: bottom tabs Beranda, Riwayat, Profil; kamera absen sebagai modal full-screen.
- Mode gelap: setelah MVP (`userInterfaceStyle` saat ini `light`).
- Ikon & splash di `loginrek-mobile/assets/`; latar splash/adaptive icon `#0E7C86` (`app.json`).

## Aksesibilitas

Kontras minimal AA, fokus terlihat, semua ikon tombol punya label aksesibilitas.
