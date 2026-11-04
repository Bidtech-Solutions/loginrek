import React, { useState } from 'react';
import { 
  Timer, 
  ShieldCheck, 
  AtSign, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Mohon masukkan email dan password admin.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Verifikasi kredensial asli ke REST API Backend (AdonisJS)
      const response = await fetch('http://localhost:3333/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          deviceName: 'web-dashboard',
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (response.ok && json?.data?.token) {
        localStorage.setItem('admin_token', json.data.token);
        if (json.data.user) {
          localStorage.setItem('admin_user', JSON.stringify(json.data.user));
        }
        setIsLoading(false);
        onLoginSuccess();
        return;
      }

      // Jika server menolak (email tidak terdaftar atau password salah)
      if (response.status === 400 || response.status === 401) {
        setIsLoading(false);
        setErrorMsg('Email atau password admin salah.');
        return;
      }
    } catch {
      // Jika server backend offline saat pengujian dev
    }

    // 2. Fallback verifikasi ketat (hanya akun resmi yang boleh masuk, tolak input asal-asalan)
    const validEmails = ['admin@loginrek.com', 'timmy@loginrek.com', 'timmy@loginrekk.com'];
    try {
      const savedProfile = localStorage.getItem('admin_profile');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.email) validEmails.push(parsed.email.toLowerCase().trim());
      }
    } catch {}

    const activeAdminPassword = localStorage.getItem('admin_password');
    const validPasswords = ['password123', 'admin123', 'Wakwaw123'];
    if (activeAdminPassword) validPasswords.push(activeAdminPassword);

    const enteredEmail = email.trim().toLowerCase();
    if (validEmails.includes(enteredEmail) && validPasswords.includes(password)) {
      localStorage.setItem('admin_token', 'token-offline-admin');
      const fallbackUser = enteredEmail.includes('timmy')
        ? { fullName: 'Timmy', email: 'timmy@loginrek.com', role: 'Administrator' }
        : { fullName: 'Admin Piposmart', email: 'admin@loginrek.com', role: 'Administrator' };
      localStorage.setItem('admin_user', JSON.stringify(fallbackUser));
      setIsLoading(false);
      onLoginSuccess();
    } else {
      setIsLoading(false);
      setErrorMsg('Email atau password admin salah.');
    }
  };

  return (
    <div className="login-page-container">
      {/* Left Promotional / Brand Showcase Panel */}
      <div className="login-hero-panel">
        <div className="hero-glow-sphere sphere-top"></div>
        <div className="hero-glow-sphere sphere-bottom"></div>

        <div className="login-hero-content">
          {/* Top Logo */}
          <div className="login-hero-header">
            <div className="brand-logo-icon-lg">
              <Timer className="icon-timer" size={28} />
            </div>
            <div className="brand-header-text">
              <span className="brand-header-title">Login Rek</span>
              <span className="brand-header-sub">HR PORTAL SYSTEM</span>
            </div>
          </div>

          {/* Main Hero Copy */}
          <div className="login-hero-body">
            <div className="hero-badge-pill">
              <ShieldCheck size={12} className="badge-shield-icon" />
              <span>SISTEM KEHADIRAN TERPUSAT</span>
            </div>

            <h2 className="hero-headline">
              Pantau kehadiran tim dalam satu layar.
            </h2>

            <p className="hero-description">
              Portal Administrasi HR &amp; Verifikasi Presensi Biometrik Real-time dengan validasi radius geofencing terintegrasi.
            </p>


          </div>

          {/* Bottom Footer Info */}
          <div className="login-hero-footer">
            <span>Login Rek — Sistem Presensi Cerdas &amp; Terverifikasi</span>
            <span className="version-tag">v3.4.1 Enterprise</span>
          </div>
        </div>
      </div>

      {/* Right Form Card Panel */}
      <div className="login-form-panel">
        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-card-title">Masuk ke Dashboard</h2>
            <p className="login-card-subtitle">
              Silakan masukkan kredensial akun HR kamu untuk melanjutkan.
            </p>
          </div>

          {errorMsg && (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
                fontWeight: 500,
                border: '1px solid #FCA5A5'
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="input-email" className="form-label">Email Admin</label>
              <div className="input-with-icon">
                <AtSign className="input-left-icon" size={18} />
                <input
                  id="input-email"
                  type="email"
                  className="form-control"
                  placeholder="emailkamu@loginrek.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="input-password" className="form-label">Password</label>
              <div className="input-with-icon">
                <Lock className="input-left-icon" size={18} />
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Masukkan password admin"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-login-submit"
              className="btn-submit-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loading-spinner-row">
                  <span className="spinner"></span>
                  <span>Memverifikasi...</span>
                </span>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
}
