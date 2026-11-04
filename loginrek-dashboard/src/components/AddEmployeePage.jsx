import React, { useState, useRef } from 'react';
import { 
  User, 
  Camera, 
  FileUp, 
  CreditCard, 
  Briefcase, 
  Lock, 
  Eye, 
  EyeOff, 
  Info, 
  GraduationCap, 
  BookOpen, 
  UserPlus, 
  ArrowLeft,
  Check,
  AlertTriangle,
  Mail
} from 'lucide-react';

/**
 * Generate email otomatis berdomain @loginrek.com berdasarkan nama depan.
 * Contoh: "Aziz Satar" -> "aziz@loginrek.com"
 */
function generateLoginrekEmail(fullName) {
  if (!fullName || !fullName.trim()) return '';
  const firstWord = fullName.trim().toLowerCase().split(/\s+/)[0];
  const cleanName = firstWord.replace(/[^a-z0-9]/g, '');
  return cleanName ? `${cleanName}@loginrek.com` : '';
}

export default function AddEmployeePage({ onBack, onSave }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [employeeType, setEmployeeType] = useState('Karyawan'); // 'Karyawan', 'Magang', 'PKL'
  const [photoPreview, setPhotoPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Email otomatis yang ter-generate secara realtime dari nama depan
  const autoEmail = generateLoginrekEmail(name);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('Ukuran foto maksimal 2 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setErrorMsg('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }
    if (!role.trim()) {
      setErrorMsg('Role / Jabatan wajib diisi.');
      return;
    }
    if (!password) {
      setErrorMsg('Password Awal Akun wajib diisi minimal 8 karakter.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg(`Password belum memenuhi syarat: saat ini baru ${password.length} karakter (minimal 8 karakter).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const emailToSend = autoEmail || `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@loginrek.com`;
    const initials = name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'EM';

    try {
      // Kirim data ke REST API backend AdonisJS
      const response = await fetch('http://localhost:3333/api/v1/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name.trim(),
          email: emailToSend,
          role: role.trim(),
          password,
          employeeType,
          avatarUrl: photoPreview || undefined,
        }),
      });

      const result = await response.json().catch(() => ({}));
      const createdEmp = result?.employee || result?.data?.employee;

      if (response.ok && createdEmp) {
        onSave(createdEmp);
        return;
      }
    } catch {
      // Jika backend tidak aktif saat offline dev, fallback ke penyimpanan lokal
    }

    // Fallback simpan lokal jika offline
    const newEmp = {
      id: Date.now(),
      name: name.trim(),
      fullName: name.trim(),
      email: emailToSend,
      role: role.trim(),
      department: 'Engineering',
      type: employeeType,
      location: 'Kantor Pusat Batam',
      phone: '',
      avatar: photoPreview || '',
      initials,
      joinDate: 'Hari ini',
      attendanceSummary: '0 Hari',
      lateCount: '0x',
      onTimeCount: '0x',
      status: 'Aktif'
    };

    onSave(newEmp);
    setIsSubmitting(false);
  };

  return (
    <div className="add-employee-view">
      {/* Top Header Section */}
      <div className="add-employee-header">
        <button 
          type="button" 
          className="btn-back-link" 
          onClick={onBack}
          title="Kembali ke Daftar Karyawan"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Data Karyawan</span>
        </button>

        <h1 className="page-title add-employee-title">Tambah Karyawan Baru</h1>
        <p className="page-subtitle add-employee-subtitle">
          Daftarkan karyawan, magang, atau siswa PKL baru untuk akses akun presensi dan data organisasi di Login Rek.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="add-employee-card">
        {errorMsg && (
          <div className="form-error-alert" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="add-employee-form">
          {/* Foto Profil Karyawan Banner */}
          <div className="photo-upload-banner">
            <div className="photo-avatar-wrapper">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview Foto Profil" className="photo-avatar-preview" />
              ) : (
                <User size={34} className="photo-placeholder-icon" />
              )}
              <div className="camera-badge" title="Format foto formal">
                <Camera size={11} />
              </div>
            </div>

            <div className="photo-info-col">
              <h3 className="photo-card-title">Foto Profil Karyawan</h3>
              <p className="photo-card-desc">
                Gunakan foto formal berwajah jelas dengan rasio 1:1 (persegi). Format file JPG atau PNG dengan ukuran maksimal 2 MB.
              </p>
              
              <div className="photo-action-row">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/png, image/jpeg, image/jpg" 
                  className="hidden-file-input"
                  onChange={handlePhotoUpload}
                />
                <button 
                  type="button" 
                  className="btn-upload-photo"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp size={15} />
                  <span>Unggah Foto</span>
                </button>
              </div>
            </div>
          </div>

          {/* Field: Nama Lengkap */}
          <div className="form-group">
            <label htmlFor="input-full-name" className="form-label">
              Nama Lengkap <span className="required-star">*</span>
            </label>
            <div className="input-icon-wrapper">
              <CreditCard size={17} className="input-leading-icon" />
              <input 
                id="input-full-name"
                type="text" 
                className="custom-form-input" 
                placeholder="cth. Aziz Satar"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
              />
            </div>
            <span className="form-helper-text">
              Ketik nama lengkap sesuai identitas resmi (KTP).
            </span>
          </div>

          {/* Field: Email Otomatis (@loginrek.com) */}
          <div className="form-group">
            <label htmlFor="input-auto-email" className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Email Akun Login</span>
              <span style={{ fontSize: 11, color: '#0e7c86', background: '#e6f4f5', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                Otomatis: @loginrek.com
              </span>
            </label>
            <div className="input-icon-wrapper">
              <Mail size={17} className="input-leading-icon" style={{ color: '#0e7c86' }} />
              <input 
                id="input-auto-email"
                type="text" 
                className="custom-form-input" 
                style={{ background: '#f8fafc', color: autoEmail ? '#0e7c86' : '#94a3b8', fontWeight: 600 }}
                placeholder="cth. aziz@loginrek.com (dibuat otomatis dari nama depan)"
                value={autoEmail}
                readOnly
              />
            </div>
            <span className="form-helper-text">
              {autoEmail ? (
                <span>Email resmi karyawan: <strong>{autoEmail}</strong> (dipakai login di aplikasi mobile).</span>
              ) : (
                <span>Ketik nama lengkap di atas, email akan otomatis terisi berdomain <strong>@loginrek.com</strong>.</span>
              )}
            </span>
          </div>

          {/* Row: Role / Jabatan and Password Awal Akun */}
          <div className="form-grid-2">
            {/* Column 1: Role / Jabatan */}
            <div className="form-group">
              <label htmlFor="input-role" className="form-label">
                Role / Jabatan <span className="required-star">*</span>
              </label>
              <div className="input-icon-wrapper">
                <Briefcase size={17} className="input-leading-icon" />
                <input 
                  id="input-role"
                  type="text" 
                  className="custom-form-input" 
                  placeholder="cth: IT, operator, HRD"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                />
              </div>
              <span className="form-helper-text">
                Menentukan level wewenang serta jadwal shift operasional tim.
              </span>
            </div>

            {/* Column 2: Password Awal Akun */}
            <div className="form-group">
              <label htmlFor="input-password" className="form-label">
                Password Awal Akun <span className="required-star">*</span>
              </label>
              <div className="input-icon-wrapper">
                <Lock size={17} className="input-leading-icon" />
                <input 
                  id="input-password"
                  type={showPassword ? 'text' : 'password'} 
                  className={`custom-form-input ${password && password.length < 8 ? 'input-warning' : password.length >= 8 ? 'input-success' : ''}`} 
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg && e.target.value.length >= 8) {
                      setErrorMsg('');
                    }
                  }}
                />
                <button 
                  type="button" 
                  className="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password length warning / validation feedback */}
              {password.length > 0 && password.length < 8 ? (
                <div className="password-validation-warning" role="alert">
                  <AlertTriangle size={14} className="warning-icon" />
                  <span>Password kurang dari 8 karakter ({password.length}/8 karakter)</span>
                </div>
              ) : password.length >= 8 ? (
                <div className="password-validation-success">
                  <Check size={14} className="success-icon" />
                  <span>Minimal 8 karakter terpenuhi ({password.length} karakter)</span>
                </div>
              ) : (
                <div className="form-helper-text helper-with-icon">
                  <Info size={14} className="helper-info-icon" />
                  <span>Wajib minimal 8 karakter untuk keamanan akun karyawan.</span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Status Kepegawaian */}
          <div className="form-group status-section-group">
            <label className="form-label">
              Status Kepegawaian <span className="required-star">*</span>
            </label>
            <p className="status-section-desc">
              Tentukan tipe ikatan kerja untuk konfigurasi rekap kehadiran dan durasi evaluasi.
            </p>

            <div className="status-cards-grid">
              {/* Card 1: Karyawan */}
              <div 
                className={`status-option-card ${employeeType === 'Karyawan' ? 'selected' : ''}`}
                onClick={() => setEmployeeType('Karyawan')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEmployeeType('Karyawan'); }}
              >
                <div className="card-top-row">
                  <div className="status-icon-badge icon-karyawan-badge">
                    <Briefcase size={18} />
                  </div>
                  <div className={`custom-radio-circle ${employeeType === 'Karyawan' ? 'active' : ''}`}>
                    {employeeType === 'Karyawan' && <Check size={11} strokeWidth={3} className="radio-check-icon" />}
                  </div>
                </div>
                <div className="card-text-body">
                  <h4 className="status-card-title">Karyawan</h4>
                  <p className="status-card-desc">
                    Pegawai tetap (PKWTT) atau kontrak berkala (PKWT) resmi institusi.
                  </p>
                </div>
              </div>

              {/* Card 2: Magang */}
              <div 
                className={`status-option-card ${employeeType === 'Magang' ? 'selected' : ''}`}
                onClick={() => setEmployeeType('Magang')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEmployeeType('Magang'); }}
              >
                <div className="card-top-row">
                  <div className="status-icon-badge icon-magang-badge">
                    <GraduationCap size={19} />
                  </div>
                  <div className={`custom-radio-circle ${employeeType === 'Magang' ? 'active' : ''}`}>
                    {employeeType === 'Magang' && <Check size={11} strokeWidth={3} className="radio-check-icon" />}
                  </div>
                </div>
                <div className="card-text-body">
                  <h4 className="status-card-title">Magang</h4>
                  <p className="status-card-desc">
                    Program magang intensif mahasiswa perguruan tinggi (3–12 bulan).
                  </p>
                </div>
              </div>

              {/* Card 3: PKL */}
              <div 
                className={`status-option-card ${employeeType === 'PKL' ? 'selected' : ''}`}
                onClick={() => setEmployeeType('PKL')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEmployeeType('PKL'); }}
              >
                <div className="card-top-row">
                  <div className="status-icon-badge icon-pkl-badge">
                    <BookOpen size={18} />
                  </div>
                  <div className={`custom-radio-circle ${employeeType === 'PKL' ? 'active' : ''}`}>
                    {employeeType === 'PKL' && <Check size={11} strokeWidth={3} className="radio-check-icon" />}
                  </div>
                </div>
                <div className="card-text-body">
                  <h4 className="status-card-title">PKL</h4>
                  <p className="status-card-desc">
                    Praktik Kerja Lapangan siswa vokasi kejuruan / SMK terakreditasi.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="form-actions-row">
            <button 
              type="submit" 
              id="btn-submit-employee"
              className="btn-submit-employee"
              disabled={isSubmitting}
            >
              <UserPlus size={18} />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Karyawan'}</span>
            </button>

            <button 
              type="button" 
              className="btn-cancel-employee"
              onClick={onBack}
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
