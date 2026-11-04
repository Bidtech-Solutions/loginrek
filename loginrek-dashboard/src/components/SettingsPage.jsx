import React, { useState, useRef, useEffect } from 'react';
import { 
  Briefcase, 
  ShieldCheck, 
  Check, 
  Eye, 
  EyeOff, 
  Save, 
  Camera, 
  UploadCloud, 
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { getInitials } from '../data/mockData';

export default function SettingsPage({ adminData, setAdminData }) {
  const [name, setName] = useState(adminData?.name || 'Admin Piposmart');
  const [email, setEmail] = useState(adminData?.email || 'admin@loginrek.com');

  useEffect(() => {
    if (adminData?.name) setName(adminData.name);
    if (adminData?.email) setEmail(adminData.email);
  }, [adminData?.name, adminData?.email]);

  // Hitung inisial nama secara realtime mengikuti input nama yang sedang diketik atau data tersimpan
  const activeName = (name && name.trim()) ? name : (adminData?.name || 'Admin Piposmart');
  const adminInitials = getInitials(activeName);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activePasswordField, setActivePasswordField] = useState('new');

  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const fileInputRef = useRef(null);

  // Dynamic Password Strength Evaluation
  const getPasswordStrength = (pwd) => {
    if (!pwd || pwd.length === 0) {
      return {
        level: 0,
        label: 'Belum Diisi',
        colorClass: '',
        barColor: 'bar-empty',
        feedback: 'Ketik kata sandi untuk mengecek tingkat keamanan.'
      };
    }

    let score = 0;
    const hasLength8 = pwd.length >= 8;
    const hasLength12 = pwd.length >= 12;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

    if (hasLength8) score += 1;
    if (hasLower && hasUpper) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;
    if (hasLength12) score += 1;

    if (pwd.length < 6 || score <= 1) {
      return {
        level: 1,
        label: 'Sangat Lemah',
        colorClass: 'strength-very-weak',
        barColor: 'bar-fill-red',
        feedback: 'Kata sandi terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi angka dan huruf.'
      };
    } else if (score === 2) {
      return {
        level: 2,
        label: 'Cukup',
        colorClass: 'strength-medium',
        barColor: 'bar-fill-amber',
        feedback: 'Kekuatan sedang. Tambahkan huruf kapital dan simbol unik seperti (!@#$) agar lebih kuat.'
      };
    } else if (score === 3 || (score === 4 && pwd.length < 10)) {
      return {
        level: 3,
        label: 'Kuat',
        colorClass: 'strength-strong',
        barColor: 'bar-fill-blue',
        feedback: 'Kata sandi kuat! Sangat baik dan aman untuk akun admin.'
      };
    } else {
      return {
        level: 4,
        label: 'Sangat Kuat',
        colorClass: 'strength-very-strong',
        barColor: 'bar-fill-emerald',
        feedback: 'Kata sandi sangat kuat dengan proteksi maksimal terhadap brute-force.'
      };
    }
  };

  // Evaluasi kekuatan kata sandi KHUSUS saat membuat kata sandi baru
  const passwordStrength = getPasswordStrength(newPassword);
  const isNewPasswordTyped = Boolean(newPassword && newPassword.length > 0);

  // Profile image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file maksimal 2MB!');
        return;

      }
      const imageUrl = URL.createObjectURL(file);
      setAdminData(prev => {
        const updated = { ...prev, avatar: imageUrl };
        try { localStorage.setItem('admin_profile', JSON.stringify(updated)); } catch {}
        return updated;
      });
      showToast('Foto profil berhasil diperbarui!');
    }
  };

  // Remove photo
  const handleRemovePhoto = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus foto profil?')) {
      setAdminData(prev => {
        const updated = { ...prev, avatar: '' };
        try { localStorage.setItem('admin_profile', JSON.stringify(updated)); } catch {}
        return updated;
      });
      fetch('http://localhost:3333/api/v1/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || adminData?.email,
          fullName: name,
          avatarUrl: '',
        })
      }).catch(() => {});
      showToast('Foto profil telah dihapus.');
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // Submit form
  const handleSave = async (e) => {
    e.preventDefault();
    if (newPassword) {
      if (!currentPassword) {
        alert('Silakan masukkan kata sandi saat ini untuk memverifikasi perubahan kata sandi!');
        return;
      }
      const activeCurrentPw = localStorage.getItem('admin_password') || 'password123';
      if (currentPassword !== activeCurrentPw) {
        alert('Kata sandi saat ini salah!');
        return;
      }
      if (newPassword === currentPassword) {
        alert('Kata sandi baru tidak boleh sama dengan kata sandi saat ini!');
        return;
      }
      if (newPassword.length < 6) {
        alert('Kata sandi baru minimal 6 karakter!');
        return;
      }
      if (newPassword !== confirmPassword) {
        alert('Konfirmasi kata sandi baru tidak cocok!');
        return;
      }
    }

    const updatedProfile = { ...adminData, name, email };
    try {
      localStorage.setItem('admin_profile', JSON.stringify(updatedProfile));
      if (newPassword) {
        localStorage.setItem('admin_password', newPassword);
      }
    } catch {}
    setAdminData(updatedProfile);

    // Kirim sinkronisasi ke backend jika server aktif
    try {
      await fetch('http://localhost:3333/api/v1/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || adminData.email,
          fullName: name,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        })
      });
    } catch {
      // Backend offline: perubahan tetap tersimpan di browser
    }

    if (newPassword) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    showToast('Perubahan data profil dan kata sandi admin berhasil disimpan!');
  };

  const handleCancel = () => {
    setName(adminData.name);
    setEmail(adminData.email);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('Perubahan dibatalkan.');
  };

  return (
    <div className="settings-view">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="floating-toast">
          <CheckCircle2 size={18} className="text-emerald" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="settings-layout-grid">
        {/* Left Form Card */}
        <div className="settings-main-card">
          <h1 className="settings-card-title">Edit Data Admin</h1>

          <form onSubmit={handleSave}>
            {/* Section 1: Data Diri & Identitas Personal */}
            <div className="settings-section">
              <div className="section-header">
                <Briefcase size={18} className="section-icon" />
                <h2 className="section-title">Data Diri &amp; Identitas Personal</h2>
              </div>

              <div className="form-group-spaced">
                <label className="form-label" htmlFor="admin-full-name">Nama Lengkap Admin</label>
                <input
                  id="admin-full-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-spaced">
                <label className="form-label" htmlFor="admin-email">Email Admin</label>
                <input
                  id="admin-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Section 2: Keamanan & Kata Sandi */}
            <div className="settings-section">
              <div className="section-header">
                <ShieldCheck size={18} className="section-icon" />
                <h2 className="section-title">Keamanan &amp; Kata Sandi</h2>
              </div>

              <div className="form-group-spaced">
                <label className="form-label" htmlFor="current-pw">Kata Sandi Saat Ini</label>
                <div className="input-with-trailing-btn">
                  <input
                    id="current-pw"
                    type={showCurrentPw ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Masukkan kata sandi saat ini"
                    value={currentPassword}
                    onFocus={() => setActivePasswordField('current')}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setActivePasswordField('current');
                    }}
                  />
                  <button
                    type="button"
                    className="btn-trailing-copy"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    aria-label="Toggle password saat ini"
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-two-col">
                <div className="form-group-spaced">
                  <label className="form-label" htmlFor="new-pw">Kata Sandi Baru</label>
                  <div className="input-with-trailing-btn">
                    <input
                      id="new-pw"
                      type={showNewPw ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Masukkan kata sandi baru"
                      value={newPassword}
                      onFocus={() => setActivePasswordField('new')}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setActivePasswordField('new');
                      }}
                    />
                    <button
                      type="button"
                      className="btn-trailing-copy"
                      onClick={() => setShowNewPw(!showNewPw)}
                      aria-label="Toggle password baru"
                    >
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group-spaced">
                  <label className="form-label" htmlFor="confirm-pw">Konfirmasi Kata Sandi Baru</label>
                  <div className="input-with-trailing-btn">
                    <input
                      id="confirm-pw"
                      type={showConfirmPw ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Ulangi kata sandi baru"
                      value={confirmPassword}
                      onFocus={() => {
                        if (newPassword) setActivePasswordField('new');
                      }}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-trailing-copy"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      aria-label="Toggle konfirmasi password"
                    >
                      {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword && newPassword && (
                    <div className={`password-match-indicator ${newPassword === confirmPassword ? 'match-success' : 'match-error'}`}>
                      {newPassword === confirmPassword ? (
                        <>
                          <Check size={14} />
                          <span>Konfirmasi kata sandi cocok</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} />
                          <span>Konfirmasi kata sandi belum cocok</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Password Strength Card - aktif saat pengguna mengetik kata sandi */}
              {isNewPasswordTyped && (
                <div className="password-strength-container">
                  <div className="password-strength-box">
                    <div className="strength-label-group">
                      <span className="strength-caption">Kekuatan Kata Sandi:</span>
                      <span className={`strength-value-bold ${passwordStrength.colorClass}`}>
                        {passwordStrength.label}
                      </span>
                    </div>

                    <div className="strength-bars">
                      <div className={`strength-bar ${passwordStrength.level >= 1 ? passwordStrength.barColor : 'bar-empty'}`}></div>
                      <div className={`strength-bar ${passwordStrength.level >= 2 ? passwordStrength.barColor : 'bar-empty'}`}></div>
                      <div className={`strength-bar ${passwordStrength.level >= 3 ? passwordStrength.barColor : 'bar-empty'}`}></div>
                      <div className={`strength-bar ${passwordStrength.level >= 4 ? passwordStrength.barColor : 'bar-empty'}`}></div>
                    </div>
                  </div>
                  <div className="password-strength-hint">
                    <span>{passwordStrength.feedback}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="settings-bottom-actions">
              <button
                type="button"
                className="btn-cancel-ghost"
                onClick={handleCancel}
              >
                Batal
              </button>
              <button
                type="submit"
                id="btn-save-settings"
                className="btn-save-primary"
              >
                <Save size={16} />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Photo Card */}
        <div className="settings-photo-card">
          <div className="photo-card-header">
            <div className="photo-title-group">
              <Camera size={18} className="text-slate" />
              <h2 className="photo-card-title">Foto Profil Admin</h2>
            </div>
            <button 
              type="button" 
              className="photo-header-cam-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Ganti foto"
            >
              <Camera size={16} />
            </button>
          </div>

          <div className="photo-card-body">
            {/* Avatar Circle with Ring */}
            <div className="profile-image-wrapper">
              <div className="profile-ring-outer">
                <img 
                  src={adminData?.avatar || "/avatars/default_avatar.png"} 
                  alt={activeName} 
                  className="profile-preview-img"
                  onError={(e) => { e.currentTarget.src = "/avatars/default_avatar.png"; }}
                />
              </div>
              <button 
                type="button"
                className="cam-badge-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Pilih foto profil baru"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/png, image/jpeg"
              onChange={handleImageUpload}
            />

            {/* Photo Action Buttons */}
            <div className="photo-actions-stack">
              <button
                type="button"
                id="btn-upload-admin-photo"
                className="btn-upload-photo"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={16} />
                <span>Unggah Foto Baru</span>
              </button>

              <button
                type="button"
                id="btn-remove-admin-photo"
                className="btn-remove-photo"
                onClick={handleRemovePhoto}
              >
                <Trash2 size={16} />
                <span>Hapus Foto</span>
              </button>
            </div>

            <p className="photo-hint-text">
              Format: JPG, PNG maks. 2MB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
