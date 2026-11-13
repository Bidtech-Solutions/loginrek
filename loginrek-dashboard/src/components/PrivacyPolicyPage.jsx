import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { ShieldCheck, Mail } from 'lucide-react';

// Nilai yang mungkin berubah — ubah di sini, jangan di teks.
const COMPANY_NAME = 'PT Solusi Bisnis Jalanin Aja Dulu';
const CONTACT_EMAIL = 'cs@bidtech.co.id';
const LAST_UPDATED = '13 November 2026';

const PAGE_TITLE = 'Kebijakan Privasi - SapaKerja';
const PAGE_DESCRIPTION =
  'Kebijakan Privasi aplikasi absensi SapaKerja: data apa yang dikumpulkan, tujuan penggunaan, izin perangkat, penyimpanan, dan hak karyawan.';

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

  // Halaman dirender di sisi klien, jadi anchor (#attendance-photos) belum ada saat peramban
  // mencoba menggulir ke sana saat load. Gulirkan manual setelah konten terpasang.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <div className="privacy-header-inner">
          <div className="privacy-brand">
            <div className="privacy-brand-icon">
              <img src="/sapakerja-simbol-putih.svg" alt="SapaKerja" width={22} height={22} className="brand-logo-img" />
            </div>
            <div className="privacy-brand-text">
              <span className="privacy-brand-title">SapaKerja</span>
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
          Kebijakan ini menjelaskan data pribadi apa yang dikumpulkan SapaKerja, untuk apa data itu
          dipakai, dan bagaimana data tersebut dijaga.
        </p>

        <section className="privacy-card">
          <h2>1. Pendahuluan</h2>
          <p>
            SapaKerja adalah aplikasi absensi karyawan (iOS, Android, dan dashboard web HR) yang
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

        <section className="privacy-card" id="attendance-photos">
          <h2>3. Foto Presensi (Attendance Photos)</h2>
          <p>
            Saat melakukan presensi, SapaKerja mengambil satu foto melalui kamera perangkat sebagai
            bukti kehadiran di lokasi kantor yang telah ditentukan. Foto dapat menampilkan wajah
            pengguna, namun SapaKerja tidak melakukan deteksi wajah maupun pengenalan wajah, tidak
            membuat data biometrik atau pola wajah (face template), dan tidak menganalisis foto
            secara otomatis. Foto disimpan di server yang dikelola oleh {COMPANY_NAME}, hanya dapat
            diakses oleh tim HR/admin perusahaan tempat pengguna bekerja, tidak dibagikan kepada
            pihak ketiga mana pun, dan disimpan selama satu tahun sejak data presensi dibuat sebelum dihapus. Pengguna
            atau perusahaan dapat meminta penghapusan foto lebih awal dengan menghubungi{' '}
            <a className="privacy-link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <p className="privacy-lang-label" lang="en">
            English
          </p>
          <p lang="en">
            When checking in, SapaKerja captures a single photo through the device camera as proof
            of attendance at the designated office location. The photo may show the user&apos;s
            face, but SapaKerja does not perform face detection or facial recognition, does not
            create biometric data or face templates, and does not automatically analyze photos.
            Photos are stored on servers operated by {COMPANY_NAME}, are only accessible to the
            HR/admin team of the user&apos;s employer, are not shared with any third parties, and
            are retained for one year after the attendance record is created before being deleted. Users or their employer may
            request earlier deletion by contacting{' '}
            <a className="privacy-link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="privacy-card">
          <h2>4. Tujuan penggunaan</h2>
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
          <h2>5. Izin perangkat</h2>
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
          <h2>6. Siapa yang dapat mengakses</h2>
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
          <h2>7. Penyimpanan dan keamanan</h2>
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
          <h2>8. Retensi data</h2>
          <p>
            Data disimpan selama karyawan aktif dan selama diperlukan untuk keperluan kepegawaian
            serta kewajiban hukum perusahaan. Setelah itu, data dihapus atau dianonimkan.
          </p>
        </section>

        <section className="privacy-card">
          <h2>9. Hak karyawan</h2>
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
          <h2>10. Anak-anak</h2>
          <p>
            Aplikasi ini tidak ditujukan untuk anak di bawah 13 tahun. Seluruh akun dibuat dan
            dikelola oleh HR perusahaan; tidak ada pendaftaran mandiri.
          </p>
        </section>

        <section className="privacy-card">
          <h2>11. Perubahan kebijakan dan kontak</h2>
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
          &copy; {COMPANY_NAME} · SapaKerja
        </span>
        <Link to="/login" className="privacy-footer-link">
          Ke halaman masuk
        </Link>
      </footer>
    </div>
  );
}
