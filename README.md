# loginrek

Sistem absensi & HR internal. Monorepo terdiri dari tiga komponen:

| Folder | Isi | Stack |
| ------ | --- | ----- |
| `loginrek-backend-go/` | High-Performance REST API (`/api/v1`) | Go + Gin, GORM, PostgreSQL / SQLite fallback, RustFS/S3 |
| `loginrek-dashboard/` | Web Dashboard Admin (Port 5173) | React 19 + Vite, Leaflet, Tailwind/CSS |
| `loginrek-mobile/` | Aplikasi Karyawan (iOS & Android) | React Native + Expo SDK (Expo Router, EAS Build) |

```
.
├── loginrek-backend-go/        # Backend REST API Go Gin (Port 3333)
├── loginrek-dashboard/         # Web Dashboard Admin React 19 Vite (Port 5173)
├── loginrek-mobile/            # Mobile App Expo React Native (Port 8081)
├── START_DEV_GO.bat            # Launcher otomatis semua 3 sistem di Windows
├── RESTART_SEMUA.bat           # Restart bersih semua 3 server
├── BUAT_APK_ANDROID.bat        # Builder APK standalone langsung tanpa Expo Go
├── docker-compose.yml          # Infra PostgreSQL + RustFS
└── .gitignore
```

---

## Cara Menjalankan di Lokal (Windows)

### Cara Cepat (Rekomendasi)
Cukup jalankan file batch:
```cmd
START_DEV_GO.bat
```
Script ini akan otomatis menyalakan:
1. **Backend Go** di `http://localhost:3333`
2. **Web Dashboard Admin** di `http://localhost:5173`
3. **Mobile Expo (Mode LAN)** di port `8081`

Jika ingin me-restart semua server yang sedang berjalan atau port nyangkut, jalankan:
```cmd
RESTART_SEMUA.bat
```

---

### Cara Manual (Per Terminal)

1. **Backend Go**:
   ```bash
   cd loginrek-backend-go
   # Menggunakan binary:
   api.exe
   # Atau langsung Go:
   go run cmd/api/main.go
   ```

2. **Web Dashboard Admin**:
   ```bash
   cd loginrek-dashboard
   npm install
   npm run dev       # http://localhost:5173
   ```

3. **Aplikasi Mobile**:
   ```bash
   cd loginrek-mobile
   npm install
   npm run dev       # npx expo start --lan -c
   ```

---

## Dokumentasi Teknis

- **Dokumentasi Kontrak API & Arsitektur**: Lihat `loginrek-dashboard/docs/` (`API.md`, `ARCHITECTURE.md`, `SCHEMA.md`, `DESIGN.md`).
- **Dokumentasi Mobile**: Lihat `loginrek-mobile/docs/` (`ARCHITECTURE.md`, `DESIGN.md`).
- **Dokumentasi Backend Go**: Lihat `loginrek-backend-go/README.md`.
