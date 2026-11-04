import React, { useState, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './components/LoginPage';
import AttendancePage from './components/AttendancePage';
import EmployeesPage from './components/EmployeesPage';
import SettingsPage from './components/SettingsPage';
import { 
  initialAdminData, 
  initialAttendanceRecords, 
  initialEmployeesData 
} from './data/mockData';
import { API_ORIGIN } from './config';
import { apiFetch, clearSession, AUTH_EXPIRED_EVENT } from './lib/api';


export default function App() {
  const location = useLocation();

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
                : `${API_ORIGIN}${rawAvatar}`)
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

  // Sesi baru dianggap sah setelah token diverifikasi ke server (GET /auth/me) dan akunnya HR/admin.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(() => !localStorage.getItem('admin_token'));
  const [adminData, setAdminData] = useState(() => loadAdminData());
  const [attendanceData, setAttendanceData] = useState(() => loadSavedAttendances());
  const [employeesData, setEmployeesData] = useState(() => loadSavedEmployees());

  // Ambil data karyawan dari database backend Go
  const fetchEmployees = async () => {
    try {
      const res = await apiFetch('/employees');
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
                ? `${API_ORIGIN}${emp.avatar}`
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
      const res = await apiFetch('/attendances?all=true');
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
                ? `${API_ORIGIN}${rawAvatar}`
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
                ? `${API_ORIGIN}${item.photoPath}`
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

  // Verifikasi token yang tersimpan saat halaman dibuka
  useEffect(() => {
    if (authChecked) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/auth/me');
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json?.data?.isAdmin) {
          setIsAuthenticated(true);
        } else {
          clearSession();
        }
      } catch {
        // Server tidak terjangkau: sesi belum bisa diverifikasi, minta login ulang
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [authChecked]);

  // Server menolak token (kedaluwarsa / bukan admin): kembali ke login
  useEffect(() => {
    const onExpired = () => {
      setAdminData(initialAdminData);
      setIsAuthenticated(false);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchEmployees();
    fetchAttendances();

    // Auto-polling realtime setiap 3 detik agar setiap absensi dari HP langsung muncul otomatis
    const timer = setInterval(() => {
      fetchAttendances();
      fetchEmployees();
    }, 3000);

    return () => clearInterval(timer);
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setAdminData(loadAdminData());
  };

  const handleLogout = () => {
    clearSession();
    setAdminData(initialAdminData);
    setIsAuthenticated(false);
  };

  if (!authChecked) {
    return <div style={{ padding: 32, color: '#475569' }}>Memeriksa sesi…</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated
            ? <Navigate to={location.state?.from?.pathname ?? '/attendance'} replace />
            : <LoginPage onLoginSuccess={handleLoginSuccess} />
        }
      />

      {/* Rute terproteksi: wajib login */}
      <Route
        element={
          isAuthenticated
            ? (
              <DashboardLayout
                adminData={adminData}
                onLogout={handleLogout}
                onGoToLogin={() => setIsAuthenticated(false)}
              />
            )
            : <Navigate to="/login" replace state={{ from: location }} />
        }
      >
        <Route index element={<Navigate to="/attendance" replace />} />

        {/* /attendance dan /attendance/:recordId memakai satu elemen agar filter tanggal tetap terjaga */}
        <Route
          path="attendance/:recordId?"
          element={
            <AttendancePage 
              attendanceData={attendanceData} 
              employeesData={employeesData}
            />
          }
        />

        {/* /employees, /employees/new, /employees/:id/edit */}
        <Route
          path="employees/*"
          element={
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
          }
        />

        <Route
          path="settings"
          element={
            <SettingsPage 
              adminData={adminData} 
              setAdminData={setAdminData} 
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/attendance" replace />} />
    </Routes>
  );
}
