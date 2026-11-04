# AGENTS.md — loginrek

Panduan untuk AI coding agent (dan developer) di monorepo ini. Dokumentasi lengkap ada di
`docs/`: `PRD.md`, `ARCHITECTURE.md`, `API.md`, `DESIGN.md`. Baca yang relevan sebelum mengubah kode,
dan perbarui di PR yang sama bila perilaku berubah.

## Apa ini

Sistem absensi & HR internal. Karyawan absen (GPS + selfie) lewat **mobile**; admin/HR memantau
lewat **dashboard** web; keduanya memakai **backend** REST API.

| Folder | Stack | Port |
| ------ | ----- | ---- |
| `loginrek-backend/` | Go + Gin, GORM, PostgreSQL (fallback SQLite), RustFS/S3 | 3333 |
| `loginrek-dashboard/` | React 19 + Vite (JavaScript) | 5173 |
| `loginrek-mobile/` | React Native + Expo SDK 57, Expo Router, TypeScript | 8081 |

Kontrak API: `docs/API.md`. Bila endpoint belum ada, sebutkan — jangan mengarang bentuk respons.

## Env

Satu file `.env` di **root** untuk semua produk (salin dari `.env.example`); jangan membuat
`.env` / `.env.example` per folder. Dibaca oleh docker compose, backend (`../.env`), dashboard
(Vite `envDir`, hanya `VITE_*`), dan mobile (`npm run dev`, hanya `EXPO_PUBLIC_*`). Variabel baru
wajib ditambahkan ke `.env.example` root. `.gitignore` juga hanya satu, di root.

## Perintah

```bash
# Infra lokal (PostgreSQL + RustFS) — opsional, backend fallback ke SQLite/disk
docker compose up -d

# Backend
cd loginrek-backend && go mod tidy && go run ./cmd/api
go vet ./... && go test ./...

# Dashboard
cd loginrek-dashboard && npm install && npm run dev      # lint: npm run lint

# Mobile
cd loginrek-mobile && npm install && npm run dev         # Expo Go
npm run lint && npm run typecheck && npm test && npm run doctor
npx expo install <pkg>                                   # SELALU untuk menambah library RN/Expo
```

## Autentikasi & hak akses (berlaku untuk semua produk)

- Satu-satunya kredensial adalah JWT dari `POST /auth/login`. **Dilarang** menambah token palsu/offline
  (mis. `token-usr-*`), kata sandi cadangan, alias akun, atau daftar akun di kode klien maupun server.
- Peran = `users.is_admin` (HR). Endpoint dashboard wajib `RequireAuth` + `RequireAdmin`; endpoint karyawan
  cukup `RequireAuth`. Route baru didaftarkan di `internal/router/router.go` dan diuji di `router_test.go`.
- Jangan menyimpan kata sandi (plaintext) di localStorage/SecureStore, dan jangan menjadikan teks `role`
  (jabatan) sebagai dasar otorisasi.
- Akun awal dibuat seeder dari env (`SEED_*`), hanya saat tabel `users` kosong.

## Backend (`loginrek-backend`)

- Go module bernama `loginrek-backend`. Lapisan: `handler` → `domain` (model + DTO) → `storage`/`database`.
- Konfigurasi hanya lewat environment (`internal/config`); template di `.env.example` (root). Jangan hardcode secret.
- Respons sukses `{ "data": ... }`. Field JSON `camelCase`.
- Perubahan model GORM → perbarui bagian skema di `docs/ARCHITECTURE.md`.

## Dashboard (`loginrek-dashboard`)

- Base URL API dibaca dari `VITE_API_URL` (lihat `src/config.js`); jangan menulis `http://localhost:3333` langsung.
- Routing memakai React Router (`BrowserRouter`, rute di `src/App.jsx`); jangan kembali ke state `currentTab`. Daftar rute ada di README.
- Server production harus mengembalikan `index.html` untuk URL yang bukan file (fallback SPA di `loginrek-dashboard/Dockerfile`).
- Token warna & pola UI: `docs/DESIGN.md`.

## Mobile (`loginrek-mobile`)

### Versi SDK: ikuti Expo Go di App Store
Expo Go di App Store hanya mendukung **satu SDK** dan biasanya tertinggal dari rilis terbaru.
**Jangan upgrade SDK** sebelum Expo Go mendukungnya, kecuali tim sudah memakai development build.
Saat upgrade: `npx expo install expo@^<sdk> && npx expo install --fix`, lalu `npm run doctor`.

### Expo cepat berubah — jangan percaya ingatan
Cek versi major `expo` di `package.json`, lalu buka dokumentasi versi itu
(`https://docs.expo.dev/versions/v57.0.0/`; topik lain mulai dari https://docs.expo.dev/llms.txt).

### Konvensi
1. Navigasi hanya dengan Expo Router. Kode non-route tidak boleh ada di `src/app/`.
2. Semua request lewat `src/lib/api.ts`; jangan `fetch` langsung di komponen
   (pengecualian: cek `/health` di layar placeholder).
3. Token **hanya** di `expo-secure-store` (`src/lib/token-storage.ts`), bukan AsyncStorage.
4. Warna/spasi dari `src/theme` — jangan hardcode hex di komponen.
5. Env publik berprefix `EXPO_PUBLIC_` masuk ke bundle — **tidak boleh berisi secret**.
6. Teks UI Bahasa Indonesia; nama kode bahasa Inggris. Import pakai alias `@/...`.
7. Utamakan modul Expo (`expo-camera`, `expo-location`, ...) — tersedia di Expo Go.
8. Permission dikonfigurasi lewat plugin `app.json` dengan alasan Bahasa Indonesia, diminta tepat sebelum dipakai.

### Jangan
- Membuat/mengedit `ios/` atau `android/` manual (di-generate, di-ignore git). Ubah lewat `app.json` / config plugin.
- Menambah library native yang tidak ada di Expo Go tanpa diskusi (mewajibkan development build + Apple Developer).
- `npm install <pkg>` langsung untuk library RN/Expo.
- Mengubah `bundleIdentifier`/`package` (`com.loginrek`) tanpa persetujuan — memutus update di store.

## Definition of done

- Backend: `go vet ./... && go test ./...` lulus.
- Dashboard: `npm run lint && npm run build` lulus.
- Mobile: `npm run lint && npm run typecheck && npm test` lulus, `npm run doctor` tanpa error,
  dicoba di Expo Go (minimal satu perangkat).
