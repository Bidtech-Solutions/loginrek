import React, { useState } from 'react';
import { Outlet } from 'react-router';
import { Menu, LogIn } from 'lucide-react';
import Sidebar from './Sidebar';

export default function DashboardLayout({ adminData, onLogout, onGoToLogin }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        adminData={adminData}
        onLogout={onLogout}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="main-content-wrapper">
        {/* Mobile Header Bar */}
        <header className="mobile-top-bar">
          <button 
            className="mobile-hamburger-btn"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Buka menu navigasi"
          >
            <Menu size={22} />
          </button>
          <div className="mobile-brand-title">SapaKerja</div>
          <button 
            className="mobile-quick-switch"
            onClick={onGoToLogin}
            title="Ke Halaman Login"
          >
            <LogIn size={18} />
          </button>
        </header>

        {/* Halaman aktif sesuai rute */}
        <main className="dashboard-main-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
