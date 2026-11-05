import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { Timer, ShieldCheck, Mail } from 'lucide-react';

// Nilai yang mungkin berubah — ubah di sini, jangan di teks.
const COMPANY_NAME = 'PT Solusi Bisnis Jalanin Aja Dulu';
const CONTACT_EMAIL = 'int.dev.bidtech@gmail.com';
const LAST_UPDATED = '5 November 2026';

const PAGE_TITLE = 'Kebijakan Privasi - Login Rek';
const PAGE_DESCRIPTION =
  'Kebijakan Privasi aplikasi absensi Login Rek: data apa yang dikumpulkan, tujuan penggunaan, izin perangkat, penyimpanan, dan hak karyawan.';

// Halaman publik (tanpa login, tanpa panggilan API) — didaftarkan sebagai Privacy Policy URL di App Store Connect.
export default function PrivacyPolicyPage() {
  useEffect(() => {
    const prevTitle = document.title;
    let meta = document.querySelector('meta[name="description"]');
    const created = !meta;
    if (created) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    const prevDescription = meta.getAttribute('content');

    document.title = PAGE_TITLE;
    meta.setAttribute('content', PAGE_DESCRIPTION);

    return () => {
      document.title = prevTitle;
      if (created) meta.remove();
      else if (prevDescription !== null) meta.setAttribute('content', prevDescription);
    };
  }, []);

  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <div className="privacy-header-inner">
          <div className="privacy-brand">
            <div className="privacy-brand-icon">
              <Timer size={22} />
            </div>
            <div className="privacy-brand-text">
              <span className="privacy-brand-title">Login Rek</span>
              <span className="privacy-brand-sub">Kebijakan Privasi</span>
            </div>
          </div>
          <span className="privacy-updated-pill">
            <ShieldCheck size={13} />
            Terakhir diperbarui: {LAST_UPDATED}
          </span>
        </div>
      </header>

      <main className="privacy-main">
        <h1 className="privacy-title">Kebijakan Privasi</h1>
        <p className="privacy-lead">
          Kebijakan ini menjelaskan data pribadi apa yang dikumpulkan LoginRek, untuk apa data itu
          dipakai, dan bagaimana data tersebut dijaga.
        </p>

        <section className="privacy-card">
          <h2>1. Pendahuluan</h2>
          <p>
            LoginRek adalah aplikasi absensi karyawan (iOS, Android, dan dashboard web HR) yang
            dikelola oleh {COMPANY_NAME} dan hanya digunakan oleh karyawan perusahaan. Akun dibuat
            oleh HR perusahaan; tidak ada pendaftaran mandiri oleh pengguna.
          </p>
        </section>

        <section className="privacy-card">
          <h2>2. Data yang dikumpulkan</h2>
          <ul>
            <li>Nama lengkap.</li>
            <li>Email (dipakai untuk masuk) dan nomor HP, bila diisi oleh HR.</li>
            <li>Jabatan, departemen, dan status kepegawaian (misalnya karyawan, magang, atau PKL).</li>
            <li>ID akun (nomor induk internal yang dibuat sistem).</li>
            <li>Foto selfie yang diambil saat presensi.</li>
            <li>Foto profil (opsional), dipilih sendiri dari galeri foto.</li>
            <li>
              Data lokasi presensi: posisi perangkat dibaca saat presensi untuk menghitung jarak ke
              titik kantor. Yang tersimpan pada catatan presensi adalah hasil verifikasi, yaitu jarak
              dari kantor (dalam meter), nama kantor, dan koordinat lokasi acuan presensi.
            </li>
            <li>
              Waktu presensi dan statusnya (tepat waktu, terlambat), serta penanda bila presensi
              dikirim belakangan karena perangkat sempat tidak terhubung internet.
            </li>
            <li>
              Data teknis: token sesi login yang disimpan di penyimpanan aman perangkat, serta log
              teknis server (misalnya alamat IP dan waktu akses) untuk keamanan dan pemeliharaan.
            </li>
          </ul>
          <p>
            Bila perangkat sedang offline, data presensi (waktu, foto, dan lokasi) disimpan
            sementara di penyimpanan aman perangkat dan dikirim ke server setelah koneksi kembali.
          </p>
        </section>

        <section className="privacy-card">
          <h2>3. Tujuan penggunaan</h2>
          <ul>
            <li>Mencatat dan memverifikasi kehadiran karyawan.</li>
            <li>Menghitung ketepatan waktu kehadiran.</li>
            <li>Menyusun rekap kehadiran bagi HR.</li>
            <li>Mengelola akun karyawan.</li>
          </ul>
          <p>
            Data tidak digunakan untuk iklan, tidak dijual, dan tidak dipakai untuk melacak
            pengguna lintas aplikasi atau situs web lain. Aplikasi tidak memuat SDK iklan, analitik,
            atau pelaporan kerusakan (crash reporting) dari pihak ketiga.
          </p>
        </section>

        <section className="privacy-card">
          <h2>4. Izin perangkat</h2>
          <ul>
            <li>
              <strong>Kamera</strong> — mengambil foto selfie untuk presensi.
            </li>
            <li>
              <strong>Lokasi saat aplikasi digunakan</strong> — memastikan Anda berada di area
              kantor. Lokasi hanya dibaca ketika aplikasi sedang dibuka untuk presensi; aplikasi
              tidak melacak lokasi di latar belakang.
            </li>
            <li>
              <strong>Galeri foto</strong> — memilih foto untuk mengubah foto profil. Aplikasi hanya
              memakai foto yang Anda pilih.
            </li>
          </ul>
          <p>
            Izin diminta tepat sebelum fitur terkait dipakai dan dapat Anda cabut kapan saja lewat
            pengaturan perangkat. Tanpa izin kamera atau lokasi, presensi tidak dapat dilakukan.
          </p>
        </section>

        <section className="privacy-card">
          <h2>5. Siapa yang dapat mengakses</h2>
          <p>
            Data presensi dan profil dapat diakses oleh karyawan yang bersangkutan dan oleh
            admin/HR {COMPANY_NAME}. Data tidak dibagikan kepada pihak ketiga, kecuali bila
            diwajibkan oleh hukum atau permintaan resmi dari instansi yang berwenang.
          </p>
          <p>
            Server dan penyimpanan foto dikelola oleh perusahaan. Satu hal yang perlu diketahui:
            pada dashboard web HR, detail presensi menampilkan peta tersemat dari Google Maps untuk
            titik lokasi presensi, sehingga Google menerima koordinat titik tersebut dan data teknis
            peramban admin yang membuka peta. Halaman web ini juga memuat huruf (font) dari Google
            Fonts.
          </p>
        </section>

        <section className="privacy-card">
          <h2>6. Penyimpanan dan keamanan</h2>
          <ul>
            <li>Data dikirim antara aplikasi/dashboard dan server melalui HTTPS.</li>
            <li>Kata sandi disimpan dalam bentuk hash, bukan teks asli.</li>
            <li>Akses ke data dibatasi berdasarkan akun dan peran (karyawan atau HR).</li>
            <li>Foto disimpan di penyimpanan objek pada server perusahaan.</li>
            <li>Token login di perangkat disimpan di penyimpanan aman sistem (Keychain/Keystore).</li>
          </ul>
          <p>
            Tidak ada sistem yang sepenuhnya bebas risiko, tetapi kami berupaya menjaga data dengan
            langkah teknis yang wajar.
          </p>
        </section>

        <section className="privacy-card">
          <h2>7. Retensi data</h2>
          <p>
            Data disimpan selama karyawan aktif dan selama diperlukan untuk keperluan kepegawaian
            serta kewajiban hukum perusahaan. Setelah itu, data dihapus atau dianonimkan.
          </p>
        </section>

        <section className="privacy-card">
          <h2>8. Hak karyawan</h2>
          <p>
            Anda dapat meminta akses, koreksi, atau penghapusan data pribadi Anda melalui HR
            perusahaan atau melalui email{' '}
            <a className="privacy-link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            . Pengelolaan data pribadi ini mengacu pada Undang-Undang Nomor 27 Tahun 2022 tentang
            Pelindungan Data Pribadi.
          </p>
        </section>

        <section className="privacy-card">
          <h2>9. Anak-anak</h2>
          <p>
            Aplikasi ini tidak ditujukan untuk anak di bawah 13 tahun. Seluruh akun dibuat dan
            dikelola oleh HR perusahaan; tidak ada pendaftaran mandiri.
          </p>
        </section>

        <section className="privacy-card">
          <h2>10. Perubahan kebijakan dan kontak</h2>
          <p>
            Kebijakan ini dapat diperbarui sewaktu-waktu. Tanggal pembaruan terakhir tercantum di
            bagian atas halaman ini. Untuk pertanyaan tentang kebijakan ini, hubungi kami:
          </p>
          <a className="privacy-contact" href={`mailto:${CONTACT_EMAIL}`}>
            <Mail size={16} />
            {CONTACT_EMAIL}
          </a>
        </section>
      </main>

      <footer className="privacy-footer">
        <span>
          &copy; {COMPANY_NAME} · Login Rek
        </span>
        <Link to="/login" className="privacy-footer-link">
          Ke halaman masuk
        </Link>
      </footer>
    </div>
  );
}
