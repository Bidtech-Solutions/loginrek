# REST API — loginrek

Dilayani oleh `loginrek-backend` (Go + Gin). Dipakai oleh `loginrek-mobile` (karyawan) dan
`loginrek-dashboard` (HR/admin).

> **Sumber kebenaran adalah kode**: route di `loginrek-backend/internal/router/router.go`,
> logika di `internal/handler/`. Dokumen ini wajib diperbarui di PR yang sama dengan perubahan endpoint.

Base URL production: `https://loginrek-api.bidtech.co.id/api/v1`.
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
| POST | `/attendances/check-in` | 🔒 | presensi masuk |
| GET | `/attendances` | 👑 | rekap presensi semua karyawan |
| GET | `/employees` | 👑 | daftar karyawan (tanpa akun admin) |
| POST | `/employees` | 👑 | tambah karyawan |
| PUT | `/employees/:id` | 👑 | ubah karyawan |
| DELETE | `/employees/:id` | 👑 | hapus karyawan + presensinya (cascade); akun admin ditolak |

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

## Rencana (belum ada)

Absen pulang (`check-out`), pengajuan izin/cuti, jadwal shift, pencabutan token saat logout.
