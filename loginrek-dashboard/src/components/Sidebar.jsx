import React from 'react';
import { NavLink, useNavigate } from 'react-router';
import { 
  CalendarClock, 
  Users, 
  Sliders, 
  LogOut, 
  Menu,
  X
} from 'lucide-react';
import { getInitials } from '../data/mockData';

export default function Sidebar({ adminData, onLogout, isMobileOpen, setIsMobileOpen }) {
  const navigate = useNavigate();
  const menuItems = [
    {
      id: 'attendance',
      to: '/attendance',
      label: 'Riwayat Absensi',
      icon: CalendarClock,
    },
    {
      id: 'employees',
      to: '/employees',
      label: 'Karyawan',
      icon: Users,
    },
    {
      id: 'settings',
      to: '/settings',
      label: 'Pengaturan',
      icon: Sliders,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="mobile-backdrop"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`sidebar-container ${isMobileOpen ? 'open' : ''}`}>
        <div className="sidebar-inner">
          {/* Top Brand Logo */}
          <div className="sidebar-brand">
            <div className="brand-logo-icon">
              <img src="/sapakerja-simbol-putih.svg" alt="SapaKerja" width={24} height={24} className="brand-logo-img" />
            </div>
            <div className="brand-text">
              <h1 className="brand-title">SapaKerja</h1>
              <span className="brand-badge">PORTAL ADMIN</span>
            </div>
            {isMobileOpen && (
              <button 
                className="close-mobile-btn" 
                onClick={() => setIsMobileOpen(false)}
                aria-label="Tutup Menu"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Navigation Section */}
          <div className="sidebar-menu-section">
            <div className="menu-category-label">MENU UTAMA</div>
            <nav className="sidebar-nav">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    id={`menu-${item.id}`}
                    to={item.to}
                    onClick={() => {
                      if (setIsMobileOpen) setIsMobileOpen(false);
                    }}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="nav-item-icon" size={19} />
                    <span className="nav-item-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Bottom Admin Profile Card */}
          <div className="sidebar-footer">
            <div 
              className="admin-profile-card"
              onClick={() => {
                navigate('/settings');
                if (setIsMobileOpen) setIsMobileOpen(false);
              }}
              title="Buka Pengaturan Akun"
            >
              <div className="admin-avatar-circle">
                <img 
                  src={adminData?.avatar || "/avatars/default_avatar.png"} 
                  alt={adminData?.name || 'Admin Piposmart'} 
                  className="avatar-img"
                  onError={(e) => { e.currentTarget.src = "/avatars/default_avatar.png"; }}
                />
              </div>
              <div className="admin-info">
                <span className="admin-name">{adminData.name ? adminData.name.split(',')[0] : 'Administrator'}</span>
                <span className="admin-role">{adminData.role || 'HR Operations Lead'}</span>
              </div>
            </div>

            <button 
              id="btn-logout"
              onClick={onLogout}
              className="logout-action-btn"
            >
              <LogOut size={16} />
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
