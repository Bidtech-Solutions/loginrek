# PRD — loginrek

> Status: **DRAFT** — disusun dari fitur yang sudah ada di kode dan dokumen lama.
> Tim produk perlu memverifikasi tujuan, target, dan prioritas di bawah.

## Latar belakang & tujuan

Pencatatan kehadiran karyawan secara manual rawan salah dan sulit dipantau. **loginrek**
adalah sistem absensi & HR internal: karyawan absen dari HP dengan bukti lokasi dan
selfie; admin/HR memantau dan mengelola data dari dashboard web.

Tujuan:
1. Karyawan dapat absen masuk < 30 detik dari buka aplikasi.
2. HR melihat status kehadiran hari ini secara langsung, tanpa rekap manual.
3. Bukti absen (lokasi + foto) cukup untuk menekan kecurangan.

## Pengguna

| Peran | Platform | Kebutuhan utama |
| ----- | -------- | --------------- |
| Karyawan | Mobile (iOS & Android) | login, absen masuk, lihat riwayat, ubah profil |
| Admin / HR | Dashboard web | pantau absensi, kelola karyawan, lihat peta & foto bukti |

## Lingkup

### Sudah ada
- Login (email / nama) dengan JWT, 30 hari.
- Absen masuk dengan selfie + koordinat GPS + jarak ke kantor; status Tepat Waktu / Terlambat.
- Satu absen per karyawan per hari.
- Mode offline: absen disimpan lokal lalu disinkronkan otomatis di latar belakang.
- Foto dikompres otomatis ke WebP (maks 1280×720).
- Dashboard: daftar & detail kehadiran (peta Leaflet), CRUD karyawan, halaman pengaturan.
- Ubah profil, kata sandi, dan avatar.

### Rencana
- Absen pulang.
- Pengajuan izin / cuti dengan persetujuan HR.
- Jadwal shift & toleransi keterlambatan per shift.
- Beberapa lokasi kantor dengan radius geofence yang dikonfigurasi.
- Ekspor rekap CSV/Excel.
- Dark mode mobile.

### Di luar lingkup (saat ini)
Penggajian, lembur, integrasi mesin fingerprint, multi-perusahaan (multi-tenant).

## Persyaratan non-fungsional

- **Keamanan**: kata sandi bcrypt; secret hanya di environment; token mobile di secure store;
  validasi geofence dan waktu **di server**, bukan di klien.
- **Ketersediaan data**: backend tetap hidup bila PostgreSQL/RustFS belum aktif (fallback lokal) — hanya untuk development.
- **Kinerja**: respons API p95 < 500 ms; foto ≤ ~500 KB setelah kompresi.
- **Bahasa & zona waktu**: UI Indonesia, `Asia/Jakarta` (WIB).

## Metrik keberhasilan

- ≥ 95% karyawan aktif absen lewat aplikasi.
- Waktu rata-rata absen < 30 detik.
- Selisih rekap HR vs. data sistem mendekati nol.

## Pertanyaan terbuka

- Berapa lokasi kantor dan radius geofence yang berlaku?
- Aturan keterlambatan: jam masuk & toleransi per shift atau global?
- Apakah absen pulang wajib dan bagaimana menghitung jam kerja?
- Siapa yang boleh jadi admin, dan perlu peran bertingkat (HR vs. super admin)?
