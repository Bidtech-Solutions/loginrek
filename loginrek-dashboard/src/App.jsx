import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import AttendancePage from './components/AttendancePage';
import EmployeesPage from './components/EmployeesPage';
import SettingsPage from './components/SettingsPage';
import { 
  initialAdminData, 
  initialAttendanceRecords, 
  initialEmployeesData 
} from './data/mockData';
import { Menu, LogIn } from 'lucide-react';

const API_BASE = 'http://localhost:3333/api/v1';

export default function App() {
  const loadAdminData = () => {
    try {
      const user = localStorage.getItem('admin_user');
      if (user) {
        const u = JSON.parse(user);
        const rawAvatar = u.avatarUrl || u.avatar || '';
        return {
          ...initialAdminData,
          name: u.fullName || u.name || initialAdminData.name,
          email: u.email || initialAdminData.email,
          role: u.role || initialAdminData.role,
          avatar: rawAvatar
            ? (rawAvatar.startsWith('http') || rawAvatar.startsWith('data:')
                ? rawAvatar
                : `http://localhost:3333${rawAvatar}`)
            : '',
        };
      }
      const saved = localStorage.getItem('admin_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return initialAdminData;
  };

  const loadSavedEmployees = () => {
    try {
      const saved = localStorage.getItem('loginrek_employees_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return initialEmployeesData;
  };

  const loadSavedAttendances = () => {
    try {
      const saved = localStorage.getItem('loginrek_attendance_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return initialAttendanceRecords;
  };

  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('admin_token')));
  const [currentTab, setCurrentTab] = useState('attendance'); // 'attendance', 'employees', 'settings'
  const [adminData, setAdminData] = useState(() => loadAdminData());
  const [attendanceData, setAttendanceData] = useState(() => loadSavedAttendances());
  const [employeesData, setEmployeesData] = useState(() => loadSavedEmployees());
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Ambil data karyawan dari database backend Go
  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE}/employees`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      if (Array.isArray(list)) {
        const mappedEmployees = list.map((emp) => ({
          ...emp,
          type: emp.type || emp.employeeType || 'Karyawan',
          avatar: emp.avatar
            ? (emp.avatar.startsWith('http') || emp.avatar.startsWith('data:')
                ? emp.avatar
                : emp.avatar.startsWith('/uploads')
                ? `http://localhost:3333${emp.avatar}`
                : emp.avatar)
            : '',
        }));
        setEmployeesData(mappedEmployees);
        try {
          localStorage.setItem('loginrek_employees_cache', JSON.stringify(mappedEmployees));
        } catch {}
      }
    } catch {
      // Backend offline: tetap gunakan data yang sudah tersimpan di browser
    }
  };

  // Ambil log presensi realtime dari database backend Go
  const fetchAttendances = async () => {
    try {
      const res = await fetch(`${API_BASE}/attendances?all=true`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      if (Array.isArray(list)) {
        const mapped = list.map((item) => {
          const empUser = item.user || {};
          const matchedEmp = employeesData.find(e => 
            (item.userId && Number(e.id) === Number(item.userId)) || 
            (item.employeeId && Number(e.id) === Number(item.employeeId)) ||
            (e.email && empUser.email && e.email.toLowerCase() === empUser.email.toLowerCase()) ||
            (e.name && empUser.fullName && e.name.toLowerCase() === empUser.fullName.toLowerCase())
          ) || {};

          const empName = empUser.fullName || empUser.name || item.name || item.fullName || matchedEmp.name || matchedEmp.fullName || 'Karyawan';
          const empType = item.type || item.employeeType || empUser.type || empUser.employeeType || matchedEmp.type || matchedEmp.employeeType || 'Karyawan';
          const empRole = empUser.role || item.role || matchedEmp.role || 'Karyawan';
          const empDept = empUser.department || item.department || matchedEmp.department || 'Engineering';
          const rawAvatar = empUser.avatarUrl || empUser.avatar || item.avatar || matchedEmp.avatar;
          const avatarUrl = rawAvatar
            ? (rawAvatar.startsWith('http') || rawAvatar.startsWith('data:')
                ? rawAvatar
                : rawAvatar.startsWith('/uploads')
                ? `http://localhost:3333${rawAvatar}`
                : rawAvatar)
            : undefined;

          return {
            id: item.id,
            userId: item.userId,
            name: empName,
            type: empType,
            email: empUser.email || item.email || matchedEmp.email,
            nik: item.nik || `LR-${String(item.userId).padStart(5, '0')}`,
            role: empRole,
            department: empDept,
            avatar: avatarUrl,
            checkInTime: item.clockInTime || '—',
            checkOutTime: item.checkOutTime || '—',
            status: item.status || (item.isLate ? 'Terlambat' : 'Tepat Waktu'),
            date: item.date,
            selfieUrl: item.photoPath
              ? item.photoPath.startsWith('http') || item.photoPath.startsWith('data:')
                ? item.photoPath
                : item.photoPath.startsWith('/uploads')
                ? `http://localhost:3333${item.photoPath}`
                : item.photoPath
              : null,
            distance: item.distanceMeters !== undefined ? `${item.distanceMeters}m` : '0m',
            latitude: item.latitude,
            longitude: item.longitude,
            isOfflineSync: item.isOfflineSync,
          };
        });
        setAttendanceData(mapped);
      }
    } catch {
      // Backend offline: tetap gunakan data awal
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchAttendances();

    // Auto-polling realtime setiap 3 detik agar setiap absensi dari HP langsung muncul otomatis
    const timer = setInterval(() => {
      fetchAttendances();
      fetchEmployees();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  // If not logged in, render the login page
  if (!isAuthenticated) {
    return (
      <LoginPage 
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          setAdminData(loadAdminData());
          setCurrentTab('attendance');
          fetchEmployees();
          fetchAttendances();
        }} 
      />
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_profile');
    setAdminData(initialAdminData);
    setIsAuthenticated(false);
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        adminData={adminData}
        onLogout={handleLogout}
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
          <div className="mobile-brand-title">Login Rek</div>
          <button 
            className="mobile-quick-switch"
            onClick={() => setIsAuthenticated(false)}
            title="Ke Halaman Login"
          >
            <LogIn size={18} />
          </button>
        </header>

        {/* Dynamic Main Body Content */}
        <main className="dashboard-main-body">
          {currentTab === 'attendance' && (
            <AttendancePage 
              attendanceData={attendanceData} 
              employeesData={employeesData}
            />
          )}

          {currentTab === 'employees' && (
            <EmployeesPage 
              employeesData={employeesData} 
              setEmployeesData={(updatedOrFn) => {
                setEmployeesData((prev) => {
                  const next = typeof updatedOrFn === 'function' ? updatedOrFn(prev) : updatedOrFn;
                  try {
                    localStorage.setItem('loginrek_employees_cache', JSON.stringify(next));
                  } catch {}
                  return next;
                });
                // Sinkronkan ulang data dari backend
                fetchEmployees();
              }}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage 
              adminData={adminData} 
              setAdminData={setAdminData} 
            />
          )}
        </main>
      </div>
    </div>
  );
}
