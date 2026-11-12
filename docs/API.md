# REST API — SapaKerja

Dilayani oleh `loginrek-backend` (Go + Gin). Dipakai oleh `loginrek-mobile` (karyawan) dan
`loginrek-dashboard` (HR/admin).

> **Sumber kebenaran adalah kode**: route di `loginrek-backend/internal/router/router.go`,
> logika di `internal/handler/`. Dokumen ini wajib diperbarui di PR yang sama dengan perubahan endpoint.

Base URL production: `https://api.sapakerja.com/api/v1`. Host lama `https://loginrek-api.bidtech.co.id` tetap dilayani untuk HP dengan build lama.
Dev: `http://localhost:3333/api/v1`, emulator Android: `http://10.0.2.2:3333/api/v1`.

## Konvensi

- Body JSON (`Content-Type: application/json`). Field JSON `camelCase`.
- Auth: `Authorization: Bearer <JWT>` (HS256, klaim `user_id` & `email`, berlaku 30 hari).
  Tidak ada token/kata sandi alternatif; JWT dari `POST /auth/login` adalah satu-satunya kredensial.
- Sukses: `{ "data": ... }`. Daftar ber-halaman: `{ "data": [...], "meta": { total, perPage, currentPage, lastPage } }`.
- Error — dua bentuk (belum diseragamkan):
  ```json
  { "message": "Email atau kata sandi salah." }
  { "errors": [{ "message": "Unauthorized" }] }
  ```
  | Status | Arti |
  | ------ | ---- |
  | 400 | body/parameter tidak valid |
  | 401 | tidak ada token / token tidak valid / kredensial login salah |
  | 403 | login sah tetapi bukan HR/admin (`is_admin = false`) di endpoint dashboard |
  | 404 | data tidak ditemukan |
  | 409 | presensi hari ini sudah tercatat |
  | 5xx | error server |
- Zona waktu "hari ini" ditentukan server: `Asia/Jakarta`.
- CORS: hanya origin di `CORS_ORIGINS` (dashboard). Mobile bukan browser sehingga tidak terpengaruh.

## Hak akses

| Tanda | Arti |
| ----- | ---- |
| – | publik |
| 🔒 | wajib login (karyawan **atau** HR/admin) |
| 👑 | wajib login **dan** `isAdmin = true` (HR) — dashboard |

`isAdmin` dikembalikan di objek `user` saat login dan `GET /auth/me`. Hanya diisi oleh seeder
(`SEED_ADMIN_*`); tidak ada endpoint yang bisa membuat atau mengubah admin. Akun `isAdmin = false`
hanya dapat memakai mobile; dashboard menolaknya.

## Endpoint

| Method | Path | Akses | Deskripsi |
| ------ | ---- | :---: | --------- |
| GET | `/health` (di luar `/api/v1`) | – | status server, database, storage (503 bila DB down) |
| GET | `/uploads/*key` (di luar `/api/v1`) | – | foto presensi/avatar, dibaca dari RustFS/disk |
| POST | `/auth/login` | – | login |
| GET | `/auth/me` | 🔒 | profil dari token aktif |
| POST | `/auth/logout` | 🔒 | logout (stateless; token tetap berlaku sampai kedaluwarsa) |
| PUT | `/auth/profile` | 🔒 | ubah nama, avatar, atau kata sandi **milik pemilik token** |
| GET | `/attendances/today` | 🔒 | status presensi hari ini |
| GET | `/attendances/my` | 🔒 | riwayat presensi milik akun aktif |
| POST | `/attendances/check-in` | 🔒 | presensi masuk |
| GET | `/attendances` | 👑 | rekap presensi semua karyawan |
| GET | `/employees` | 👑 | daftar karyawan (tanpa akun admin) |
| POST | `/employees` | 👑 | tambah karyawan |
| PUT | `/employees/:id` | 👑 | ubah karyawan |
| DELETE | `/employees/:id` | 👑 | hapus karyawan + presensinya (cascade); akun admin ditolak |
| GET | `/updates/manifest` (di luar `/api/v1`) | – | manifest update OTA (Expo Updates v1) |
| GET, HEAD | `/updates/files/*` (di luar `/api/v1`) | – | bundle & aset update OTA |

<!-- DIUBAH (OTA): dua baris `/updates/*` di tabel di atas baru; keduanya publik dan di luar /api/v1. Rincian: bagian "Update OTA". -->


### `POST /auth/login`
```json
{ "email": "hr@loginrek.com", "password": "...", "deviceName": "Pixel 8" }
```
Pencarian akun hanya lewat email persis (tidak peka huruf besar). Input tanpa `@` dilengkapi
`@loginrek.com` (mis. `budi` → `budi@loginrek.com`). Tidak ada alias, pencarian nama, atau
kata sandi cadangan.

200:
```json
{ "data": { "token": "<jwt>", "expiresAt": null,
            "user": { "id": 1, "fullName": "...", "email": "...", "initials": "AL",
                      "role": "...", "department": "...", "employeeType": "Karyawan",
                      "avatarUrl": null, "isAdmin": false } } }
```
Gagal: 400 (field kosong) atau **401** `Email atau kata sandi salah.` — pesan yang sama untuk
email tak terdaftar maupun kata sandi salah.

### `PUT /auth/profile` 🔒
```json
{ "fullName": "Budi", "avatarUrl": "data:image/jpeg;base64,...",
  "currentPassword": "...", "newPassword": "..." }
```
Akun yang diubah selalu pemilik token. Mengganti kata sandi wajib menyertakan `currentPassword`
yang benar (min. 6 karakter untuk yang baru) — salah → 400. `avatarUrl` base64 dikompres ke WebP.

### `GET /attendances/today` 🔒
```json
{ "data": { "hasAttended": true, "attendance": { "...": "..." },
            "serverTime": "08:05:12", "today": "2026-11-04" } }
```
`attendance` bernilai `null` bila belum absen.

### `GET /attendances/my` 🔒
Mengambil seluruh riwayat presensi milik akun aktif (terisolasi per user).
Query: `page` (default 1), `limit` (default 100), `all=true` (limit 500), `month=YYYY-MM`, `date=YYYY-MM-DD`.
Urut tanggal menurun (`date desc, id desc`).
200:
```json
{
  "meta": { "total": 12, "perPage": 100, "currentPage": 1, "lastPage": 1 },
  "data": [
    {
      "id": 1,
      "userId": 2,
      "date": "2026-11-09",
      "clockInTime": "08.05 WIB",
      "status": "Tepat Waktu",
      "isLate": false,
      "photoPath": "attendances/2026-11/....webp",
      "latitude": 1.105925,
      "longitude": 104.075342,
      "distanceMeters": 15,
      "officeName": "Kantor Piposmart",
      "isOfflineSync": false,
      "createdAt": "..."
    }
  ]
}
```

### `POST /attendances/check-in` 🔒
```json
{ "clockInTime": "08.05 WIB", "isLate": false, "status": "Tepat Waktu",
  "photo": "data:image/jpeg;base64,...", "latitude": -6.2, "longitude": 106.8,
  "distanceMeters": 12, "officeName": "Kantor", "isOfflineSync": false,
  "date": "2026-11-04" }
```
Hanya `clockInTime` wajib. `photo` base64 dikompres server ke WebP (maks 1280×720) dan
disimpan ke RustFS (internal) atau `public/uploads/`; URL foto dilayani lewat `GET /uploads/*key`.
`date` opsional (sinkronisasi dari antrean offline mobile); default hari ini. Satu presensi per
user per tanggal → 409 bila duplikat. 200: `{ "data": { "message": "Presensi berhasil dicatat", "attendance": {...} } }`.

### `GET /attendances` 👑
Query: `page` (1), `limit` (20), `all=true` (limit 500), `date=YYYY-MM-DD`. Urut `id` menurun.

### `POST /employees` / `PUT /employees/:id` 👑
`POST` wajib: `fullName`, `role` (jabatan, teks bebas — **bukan** hak akses), `password` (min. 6).
Opsional: `email` (dibuat otomatis bila kosong; 400 bila sudah terdaftar), `department`,
`employeeType`, `phone`, `avatarUrl`. Akun baru selalu `isAdmin = false`. `PUT` menerima field
yang sama, semuanya opsional. Respons: 201 / 200.

<!-- DIUBAH (OTA): seluruh bagian "Update OTA" baru; sumbernya loginrek-backend/internal/updates/updates.go. -->
## Update OTA (expo-updates)

Server update untuk `expo-updates` (protokol **Expo Updates v1**). **Publik** (tanpa JWT) dan **bukan** bagian dari
`/api/v1`: URL production `https://api.sapakerja.com/updates/manifest` (diset di `app.json` → `updates.url`).
Tidak memakai amplop `{ "data": ... }`; error berupa teks biasa. Isi disajikan dari folder `UPDATES_DIR`
(production: `/data/updates`, read-only); cara kerja dan tata letaknya ada di `ARCHITECTURE.md`.

### `GET /updates/manifest`
Header permintaan (dikirim otomatis oleh klien):

| Header | Keterangan |
| ------ | ---------- |
| `expo-platform` | wajib: `ios` atau `android` |
| `expo-runtime-version` | wajib, mis. `1.0.2`; hanya `A-Z a-z 0-9 . _ -` (maks. 64) |
| `expo-channel-name` | opsional, default `production`; format sama seperti runtime |
| `expo-protocol-version` | opsional; bila ada harus `1` |
| `expo-expect-signature` | bila ada, respons menyertakan tanda tangan (code signing) |

Respons:

| Status | Arti |
| ------ | ---- |
| 200 | `multipart/mixed` dengan satu bagian `manifest` (JSON). Bila `expo-expect-signature` dikirim, bagian itu memuat header `expo-signature: sig="<base64>", keyid="main"` (RSA-SHA256 atas byte manifest persis seperti dikirim). |
| 204 | belum ada update untuk (channel, runtime) ini; klien tetap memakai bundle bawaan |
| 400 | `expo-platform` / `expo-runtime-version` / `expo-channel-name` tidak valid, atau `expo-protocol-version` ≠ `1` |
| 405 | method selain GET |
| 500 | `latest.json` / manifest / tanda tangan di server rusak atau hilang |

Header respons (200 dan 204): `expo-protocol-version: 1`, `expo-sfv-version: 0`, `cache-control: private, max-age=0`.

### `GET|HEAD /updates/files/<channel>/<runtime>/<publishId>/<path>`
Bundle (`_expo/static/js/<platform>/*.hbc`) dan aset. URL-nya muncul di manifest. Karena `publishId` ada di path, isinya tidak
pernah berubah: `Cache-Control: public, max-age=31536000, immutable` (aman di-cache Cloudflare). Pengecualian
`latest.json`: `no-store`. Daftar isi folder → 404; method selain GET/HEAD → 405.

## Rencana (belum ada)

Absen pulang (`check-out`), pengajuan izin/cuti, jadwal shift, pencabutan token saat logout.
