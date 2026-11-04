# Login Rek - High-Performance Go Backend

Backend berkinerja tinggi untuk sistem presensi **Login Rek**, dibangun menggunakan arsitektur **Go + Gin + GORM + PostgreSQL + RustFS / S3 Object Storage**.

---

## 🚀 Fitur Utama & Tech Stack

1. **Framework REST API**:
   - [Gin Web Framework](https://github.com/gin-gonic/gin) — HTTP router & API controller ultra cepat dengan overhead memori minimal.
   - Port default: `3333` (kompatibel penuh dengan aplikasi Mobile & Web Dashboard yang sudah ada).

2. **Keamanan & Autentikasi**:
   - **JWT (JSON Web Token)** (`golang-jwt/jwt/v5`) dengan claim berbasis user ID & email.
   - **Bcrypt Hashing** (`golang.org/x/crypto/bcrypt`) untuk keamanan kata sandi.

3. **Database & ORM**:
   - [GORM](https://gorm.io/) dengan driver **PostgreSQL** (`gorm.io/driver/postgres`).
   - **Smart Zero-Downtime Fallback**: Jika PostgreSQL belum dinyalakan di local environment, sistem secara otomatis beralih ke **SQLite lokal** (`tmp/db.sqlite3`) tanpa error atau crash.
   - AutoMigrate skema tabel (`users`, `attendances`, `access_tokens`).
   - Default seeder otomatis untuk akun testing (`admin@loginrek.com` / `password123` & `achul@loginrek.com` / `wakwaw1234`).

4. **Object Storage**:
   - Mendukung **RustFS** / MinIO / AWS S3 menggunakan SDK resmi [minio-go/v7](https://github.com/minio/minio-go).
   - Dilengkapi **Local Disk Storage Fallback** (`public/uploads/`) jika server RustFS belum aktif.

5. **Automatic Image Compression Engine**:
   - Setiap foto selfie presensi dan foto avatar profil otomatis diproses sebelum disimpan:
     - **Proportional Auto-Resize**: Menyesuaikan dimensi proporsional ke resolusi maksimal **1280x720** (atau 720x1280 untuk orientasi potret/portrait). Aspek rasio asli tetap terjaga tanpa terpotong (*no crop / no distortion*).
     - **Auto-Orientation**: Memperbaiki orientasi EXIF kamera HP.
     - **WebP Encoding**: Dikonversi menjadi format **`.webp`** modern dengan kompresi hemat kuota (ukuran berkurang hingga 80-90% dibanding JPEG/PNG).

---

## 📁 Struktur Direktori

```
loginrek-backend-go/
├── cmd/
│   └── api/
│       └── main.go                 # Entrypoint server Gin & registrasi route
├── internal/
│   ├── config/
│   │   └── config.go               # Pembaca konfigurasi environment (.env)
│   ├── database/
│   │   └── postgres.go             # Koneksi GORM PostgreSQL + SQLite fallback + Seeder
│   ├── domain/
│   │   └── models.go               # GORM Models, Relasi, DTOs & JSON Response Transformers
│   ├── handler/
│   │   ├── attendance_handler.go   # Check-in selfie, today status, riwayat presensi
│   │   ├── auth_handler.go         # Login, get profile me, update profile avatar
│   │   └── employee_handler.go     # CRUD Karyawan (list, add, edit, cascade delete)
│   ├── middleware/
│   │   ├── auth_middleware.go      # Verifikasi Bearer JWT token
│   │   └── cors_middleware.go      # CORS untuk mobile & web dashboard
│   └── storage/
│       ├── image_processor.go      # Base64 decoder, Lanczos resize maks 1280x720, WebP
│       └── rustfs.go               # RustFS S3 client + local disk fallback
├── public/
│   └── uploads/                    # Folder statis upload gambar lokal
├── .env.example                    # Template konfigurasi environment
├── .env                            # Konfigurasi aktif
├── go.mod                          # Modul Go & dependencies
├── README.md                       # Dokumentasi resmi
└── RUN_GO_BACKEND.bat              # Script 1-klik jalankan backend di Windows
```

---

## 🛠️ Cara Menjalankan

### Persyaratan
- **Golang** versi 1.22 atau lebih baru.
- (Opsional) PostgreSQL & RustFS jika ingin menjalankan full cloud stack.

### 1. Jalankan Langsung (1-Klik di Windows)
Klik dua kali file:
```
RUN_GO_BACKEND.bat
```
Script akan otomatis mengunduh dependensi (`go mod tidy`) dan menjalankan server di `http://localhost:3333`.

### 2. Atau Jalankan Manual via Terminal
```bash
cd loginrek-backend-go
go mod tidy
go run cmd/api/main.go
```

---

## 🔌 Endpoint API REST (`/api/v1`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/health` | Health check status server, database & storage |
| `POST` | `/api/v1/auth/login` | Login user / karyawan / admin |
| `PUT` | `/api/v1/auth/profile` | Update profil & foto avatar (auto WebP) |
| `GET` | `/api/v1/auth/me` | Ambil data profil user yang sedang login (Bearer JWT) |
| `POST` | `/api/v1/auth/logout` | Logout |
| `GET` | `/api/v1/employees` | List data seluruh karyawan (untuk web dashboard) |
| `POST` | `/api/v1/employees` | Tambah karyawan baru (auto WebP avatar) |
| `PUT` | `/api/v1/employees/:id` | Update data karyawan |
| `DELETE` | `/api/v1/employees/:id` | Hapus karyawan beserta data presensinya (CASCADE) |
| `GET` | `/api/v1/attendances` | Riwayat presensi (mendukung pagination & filter tanggal) |
| `GET` | `/api/v1/attendances/today` | Status presensi hari ini user aktif |
| `POST` | `/api/v1/attendances/check-in` | Presensi masuk selfie (auto WebP, maks 1280x720) |

