# Login Rek — Web Dashboard Admin

Portal administrasi web untuk HR dan manajemen presensi **Login Rek**, dibangun menggunakan **React 19 + Vite + Tailwind/CSS + Leaflet**.

---

## 🚀 Fitur Utama

- **Live Attendance Monitoring**: Tinjauan rekap presensi masuk & pulang karyawan harian secara *real-time*.
- **Peta Interaktif (Leaflet)**: Peta titik lokasi presensi karyawan lengkap dengan radius geofencing kantor.
- **Manajemen Karyawan (CRUD)**: Kelola data pegawai, jabatan, departemen, dan foto profil.
- **Pengaturan Jam Kerja & Radius**: Konfigurasi radius presensi kantor, toleransi keterlambatan, dan jam kerja.
- **Integrasi Backend Go**: Mengonsumsi REST API langsung dari `loginrek-backend-go` (`http://localhost:3333/api/v1`).

---

## 🛠️ Perintah Pengembangan

```bash
# Menjalankan development server (port 5173)
npm run dev

# Membangun bundle produksi (output di dist/)
npm run build

# Menjalankan preview dari build produksi
npm run preview

# Linter
npm run lint
```

---

## 📁 Struktur Direktori

```
loginrek-dashboard/
├── docs/               # Dokumentasi kontrak API, arsitektur, dan skema
├── public/             # Asset statis, favicon, avatar default
├── src/
│   ├── assets/         # Gambar & logo
│   ├── components/     # Komponen halaman (Attendance, Employees, Settings, Login, Sidebar)
│   ├── data/           # Mock data & state fallback
│   ├── App.jsx         # Router & root component
│   └── main.jsx        # Entrypoint Vite
├── package.json
└── vite.config.js
```
