# SapaKerja

> Nama produk: **SapaKerja** (sebelumnya prototipe "loginrek"). Nama folder, slug EAS, bundle id `id.co.bidtech.loginrek`, go module, image Docker, dan domain email akun sengaja tetap memakai `loginrek`.

Sistem absensi & HR internal. Karyawan absen (GPS + selfie) lewat aplikasi mobile; admin/HR
memantau dan mengelola data lewat dashboard web; keduanya memakai satu REST API.

| Folder | Isi | Stack |
| ------ | --- | ----- |
| `loginrek-backend/` | REST API (`/api/v1`, port 3333) | Go + Gin, GORM, PostgreSQL / SQLite fallback, RustFS/S3 |
| `loginrek-dashboard/` | Web Dashboard Admin (port 5173) | React 19 + Vite, Leaflet |
| `loginrek-mobile/` | Aplikasi Karyawan (iOS & Android) | React Native + Expo SDK (Expo Router, EAS Build) |

```
.
├── .github/workflows/loginrek.yml   # CI/CD: check → build image → deploy VPS
├── loginrek-backend/
├── loginrek-dashboard/
├── loginrek-mobile/
├── docs/                            # PRD, API, DESIGN, ARCHITECTURE
├── .env.example                     # SATU template env semua produk (+ docker compose)
├── docker-compose.yml               # infra dev: PostgreSQL + RustFS
├── docker-compose.prod.yml          # stack production (VPS)
├── AGENTS.md / CLAUDE.md            # panduan untuk AI agent & developer
└── README.md                        # satu-satunya README
```

## Dokumentasi

- [`docs/PRD.md`](docs/PRD.md) — kebutuhan produk
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arsitektur, skema database, mobile, deploy
- [`docs/API.md`](docs/API.md) — kontrak REST API (daftar endpoint ada di sini)
- [`docs/DESIGN.md`](docs/DESIGN.md) — token warna & pola UI

---

## Menjalankan di lokal

Persyaratan: Go ≥ 1.22, Node ≥ 22, (opsional) Docker.

Siapkan env (satu file untuk semua produk), lalu infra opsional — tanpa ini backend
otomatis memakai SQLite dan disk lokal:
```bash
cp .env.example .env          # isi CHANGE_ME (JWT_SECRET min. 32 karakter: openssl rand -hex 32)
docker compose up -d
```

Jalankan tiap sistem di terminal masing-masing:

1. **Backend** — `http://localhost:3333`
   ```bash
   cd loginrek-backend
   go run ./cmd/api
   ```
   Saat database masih kosong, server membuat akun dari `.env`: **HR/admin** (`SEED_ADMIN_*`, bisa login
   dashboard dan mobile) dan **karyawan uji** (`SEED_EMPLOYEE_*`, hanya mobile). Tes: `go test ./...`.
2. **Dashboard** — `http://localhost:5173`
   ```bash
   cd loginrek-dashboard
   npm install
   npm run dev
   ```
   Alamat API diatur lewat `VITE_API_URL` (default `http://localhost:3333`).
3. **Mobile** — port 8081, scan QR dengan Expo Go
   ```bash
   cd loginrek-mobile
   npm install
   npm run dev
   ```
   Build APK uji internal: `npx eas-cli@latest build --profile preview --platform android`.


### Semua lewat Docker + APK di HP Android (satu Wi-Fi)

1. **Jalankan backend + dashboard** (PostgreSQL, RustFS, backend, dashboard):
   ```bash
   docker compose up -d --build
   docker compose ps                      # semua "running"/"healthy"
   docker compose logs -f backend         # akun seed dibuat saat database masih kosong
   ```
   Dashboard `http://localhost:5173` (login dengan `SEED_ADMIN_*`), API `http://localhost:3333/health`.
   `VITE_API_URL` dibakar saat build — ubah di `.env` lalu `docker compose up -d --build dashboard`.
2. **Izinkan HP mengakses PC.** Port 3333 sudah terbuka ke semua interface, tetapi Windows Firewall
   memblokir koneksi masuk di jaringan bertipe *Public*. Di PowerShell **sebagai Administrator**:
   ```powershell
   Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
   New-NetFirewallRule -DisplayName "loginrek-api 3333" -Direction Inbound -Protocol TCP -LocalPort 3333 -Action Allow -Profile Private
   ```
   Uji dari browser HP: `http://<IP-PC>:3333/health` harus menjawab `{"status":"ok",...}`.
   IP PC: `ipconfig` → IPv4 adapter Wi-Fi. Bila gagal padahal firewall benar, matikan *AP/Client Isolation* di router.
3. **Arahkan APK ke IP itu.** Di [loginrek-mobile/eas.json](loginrek-mobile/eas.json) profil `preview`:
   `"EXPO_PUBLIC_API_URL": "http://<IP-PC>:3333/api/v1"`. Nilai ini ikut terbakar di APK (file `.env` tidak
   dibaca EAS), jadi build ulang bila IP PC berubah — sebaiknya kunci IP PC lewat DHCP reservation di router.
4. **Bangun APK di cloud EAS** (butuh akun Expo; EAS Build lokal tidak tersedia di Windows):
   ```bash
   cd loginrek-mobile
   npm install && npm run doctor
   npx eas-cli@latest login
   npx eas-cli@latest build --platform android --profile preview
   ```
   Selesai (±10–20 menit) EAS memberi tautan/QR unduh `.apk`. Buka di HP, izinkan *install dari sumber
   tidak dikenal*, lalu login dengan akun karyawan (`SEED_EMPLOYEE_*` atau yang dibuat HR di dashboard).
   Lalu lintas HTTP (bukan HTTPS) sudah diizinkan lewat `usesCleartextTraffic` di `app.json`.

---

## Backend (`loginrek-backend`)

Backend berkinerja tinggi: **Go + Gin + GORM + PostgreSQL + RustFS / S3**.

- **REST API** — [Gin](https://github.com/gin-gonic/gin), port default `3333`. Endpoint: lihat [`docs/API.md`](docs/API.md).
- **Keamanan** — JWT (`golang-jwt/jwt/v5`, klaim user ID & email) dan hashing kata sandi bcrypt.
- **Database** — GORM + PostgreSQL. Bila PostgreSQL belum menyala, otomatis fallback ke **SQLite lokal**
  (`tmp/db.sqlite3`) tanpa error. AutoMigrate tabel `users`, `attendances`, `access_tokens`, dan seeder
  akun uji (lihat `internal/database/postgres.go`).
- **Object storage** — RustFS / MinIO / S3 lewat [minio-go/v7](https://github.com/minio/minio-go);
  fallback ke disk lokal (`public/uploads/`) bila RustFS belum aktif.
- **Kompresi gambar otomatis** — foto selfie dan avatar di-resize proporsional (maks 1280×720 atau 720×1280,
  tanpa crop), orientasi EXIF diperbaiki, lalu di-encode ke **WebP** (hemat 80–90% dibanding JPEG/PNG).

```
loginrek-backend/
├── cmd/api/main.go                  # entrypoint: config → database → storage → router
├── internal/
│   ├── config/config.go             # pembaca environment (.env)
│   ├── database/postgres.go         # koneksi GORM + SQLite fallback + seeder
│   ├── domain/models.go             # model GORM, relasi, DTO & transformer respons
│   ├── router/router.go             # semua route + proteksi (publik / login / HR-admin)
│   ├── handler/
│   │   ├── attendance_handler.go    # check-in selfie, status hari ini, riwayat
│   │   ├── auth_handler.go          # login, profil (me), update profil & avatar
│   │   └── employee_handler.go      # CRUD karyawan (list, tambah, ubah, hapus cascade)
│   ├── middleware/
│   │   ├── auth_middleware.go       # verifikasi Bearer JWT (RequireAuth) + RequireAdmin
│   │   └── cors_middleware.go       # CORS hanya untuk origin di CORS_ORIGINS
│   └── storage/
│       ├── image_processor.go       # decode base64, resize Lanczos, WebP
│       └── rustfs.go                # klien RustFS S3 + fallback disk lokal
├── public/uploads/                  # upload gambar lokal
├── Dockerfile
└── go.mod
```

---

## Dashboard (`loginrek-dashboard`)

Portal web untuk HR dan manajemen presensi: **React 19 + Vite + Leaflet**.

- **Live attendance monitoring** — rekap presensi harian karyawan.
- **Peta interaktif (Leaflet)** — titik lokasi presensi beserta radius geofencing kantor.
- **Manajemen karyawan (CRUD)** — data pegawai, jabatan, departemen, foto profil.
- **Pengaturan** — radius presensi, toleransi keterlambatan, jam kerja.
- **Integrasi backend** — memakai REST API `loginrek-backend` lewat `VITE_API_URL` (`src/config.js`).

Rute (React Router, `BrowserRouter`):

| URL | Halaman |
| --- | ------- |
| `/login` | login admin |
| `/attendance`, `/attendance/:recordId` | riwayat absensi, detail presensi |
| `/employees`, `/employees/new`, `/employees/:id/edit` | daftar, tambah, ubah karyawan |
| `/settings` | pengaturan akun |

Semua rute selain `/login` wajib login (redirect ke `/login`, lalu kembali ke halaman tujuan).

```bash
npm run dev       # dev server (5173)
npm run build     # bundle produksi -> dist/
npm run preview   # preview hasil build
npm run lint
```

```
loginrek-dashboard/
├── public/             # aset statis, favicon, avatar default
├── src/
│   ├── assets/         # gambar & logo
│   ├── components/     # halaman (Attendance, Employees, Settings, Login), Sidebar, DashboardLayout
│   ├── data/           # mock data & state fallback
│   ├── config.js       # API_ORIGIN / API_BASE dari VITE_API_URL
│   ├── App.jsx         # state data + definisi rute (React Router)
│   └── main.jsx        # entrypoint Vite
├── Dockerfile
├── package.json
└── vite.config.js
```

---

## Mobile (`loginrek-mobile`)

Aplikasi karyawan: login, absen masuk (GPS + selfie), riwayat, mode offline-sync.
**React Native + Expo SDK 57**, Expo Router, TypeScript. Aturan pengembangan lengkap ada di
[`AGENTS.md`](AGENTS.md); arsitektur dan build EAS di [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```bash
npm run dev          # Expo Go (LAN)
npm run dev:tunnel   # bila HP & laptop beda jaringan
npm run lint && npm run typecheck && npm test
```

---

## Deploy

Push ke `main` menjalankan `.github/workflows/loginrek.yml`: lint/build → image GHCR
(`loginrek-backend`, `loginrek-dashboard`) → `docker compose -f docker-compose.prod.yml up -d`
di VPS di belakang Traefik:

| URL | Service |
| --- | ------- |
| https://sapakerja.com | dashboard HR |
| https://api.sapakerja.com | REST API + foto `/uploads/*` + update OTA (dipakai mobile & dashboard) |
| https://loginrek.bidtech.co.id | domain lama dashboard — tetap dilayani langsung (bukan redirect) |
| https://loginrek-api.bidtech.co.id | domain lama API — tetap dilayani langsung; dipakai HP dengan build lama, jangan di-redirect (merusak POST + header `Authorization`) |

Secrets dan variabel server: lihat komentar di workflow dan `.env.example`.
