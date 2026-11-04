import React, { useState, useMemo, useRef, useEffect } from 'react';
import AttendanceDetailPage from './AttendanceDetailPage';
import { 
  Users, 
  Check, 
  Clock, 
  Hourglass, 
  Calendar, 
  Filter, 
  Search, 
  Eye, 
  ChevronDown, 
  MapPin, 
  Smartphone, 
  ShieldCheck, 
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const INDO_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function toIsoDateString(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatIndonesianDateLabel(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = getYesterday();

  const dayName = INDO_DAYS[date.getDay()];
  const dayNum = date.getDate();
  const monthName = INDO_MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear();
  const formatted = `${dayName}, ${dayNum} ${monthName} ${year}`;

  if (isSameDay(date, today)) {
    return `Hari Ini — ${formatted}`;
  }
  if (isSameDay(date, yesterday)) {
    return `Kemarin — ${formatted}`;
  }
  // Preserving initial demo context for 14 Okt 2026
  if (date.getDate() === 14 && date.getMonth() === 9 && date.getFullYear() === 2026) {
    return `Hari Ini — ${formatted}`;
  }
  return formatted;
}

export default function AttendancePage({ attendanceData = [], employeesData = [] }) {
  // Initial date matches "Hari Ini — Rabu, 14 Okt 2026"
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // current month (0-indexed)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());

  const [statusFilter, setStatusFilter] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const datePickerRef = useRef(null);
  const itemsPerPage = 8;

  // Handle date selection from calendar or presets
  const handleSelectDate = (newDate) => {
    setSelectedDate(newDate);
    setViewMonth(newDate.getMonth());
    setViewYear(newDate.getFullYear());
    setIsDatePickerOpen(false);
    setCurrentPage(1);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Close popup on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDatePickerOpen(false);
      }
    };

    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDatePickerOpen]);

  // Calendar cells generation for viewMonth & viewYear
  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay();
    const firstDayIndex = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        isPrev: true
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        isCurrentMonth: true
      });
    }
    const totalSlots = cells.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (cells.length < totalSlots) {
      cells.push({
        day: nextDay++,
        isCurrentMonth: false,
        isNext: true
      });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const selectedDateIso = toIsoDateString(selectedDate);

  // Records filtered by date + employees sync
  const recordsForDate = useMemo(() => {
    // 1. Explicit attendance records for this date
    const dateRecords = (attendanceData || []).filter(item => !item.date || item.date === selectedDateIso);

    // 2. Enrich date records with employee info if any fields are missing
    const enrichedDateRecords = dateRecords.map((item) => {
      const matched = (employeesData || []).find(e => 
        (item.userId && Number(e.id) === Number(item.userId)) ||
        (item.employeeId && Number(e.id) === Number(item.employeeId)) ||
        (item.name && item.name !== 'Karyawan' && (e.name === item.name || e.fullName === item.name)) ||
        (item.email && e.email && item.email.toLowerCase() === e.email.toLowerCase())
      );
      if (!matched) return item;
      return {
        ...item,
        name: (item.name && item.name !== 'Karyawan') ? item.name : (matched.name || matched.fullName || item.name),
        type: (item.type && item.type !== '—') ? item.type : (matched.type || matched.employeeType || 'Karyawan'),
        department: (item.department && item.department !== 'Engineering') ? item.department : (matched.department || item.department),
        role: (item.role && item.role !== 'Karyawan') ? item.role : (matched.role || item.role),
        avatar: item.avatar || matched.avatar || '',
        nik: item.nik || matched.nik || `LR-${String(item.userId || matched.id).padStart(5, '0')}`,
      };
    });

    // 3. Track employees who already have an attendance record on this date
    const coveredKeys = new Set();
    enrichedDateRecords.forEach(r => {
      if (r.employeeId) coveredKeys.add(String(r.employeeId).toLowerCase());
      if (r.userId) coveredKeys.add(String(r.userId).toLowerCase());
      if (r.name) coveredKeys.add(String(r.name).toLowerCase());
      if (r.email) coveredKeys.add(String(r.email).toLowerCase());
    });

    // 4. For any employee in employeesData without a record on this date,
    //    show them with checkInTime: '—' and status: 'Belum Hadir'
    const defaultEmployeeRecords = (employeesData || [])
      .filter(emp => !coveredKeys.has(String(emp.id).toLowerCase()) && !coveredKeys.has(String(emp.name).toLowerCase()))
      .map(emp => ({
        id: `att-${emp.id}-${selectedDateIso}`,
        employeeId: emp.id,
        name: emp.name,
        avatar: emp.avatar || '',
        initials: emp.initials || (emp.name ? emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'EM'),
        type: emp.type || emp.employeeType || 'Karyawan',
        department: emp.department || 'Engineering',
        role: emp.role || 'Staff',
        nik: emp.nik || `ID-${emp.id}`,
        date: selectedDateIso,
        checkInTime: '—',
        status: 'Belum Hadir',
        location: emp.location || 'Kantor Pusat Batam',
        geofenceStatus: 'Belum Terdeteksi',
        biometricMatch: '—',
        device: '—',
        ipAddress: '—',
        notes: 'Belum melakukan presensi pada tanggal ini'
      }));

    return [...enrichedDateRecords, ...defaultEmployeeRecords];
  }, [attendanceData, employeesData, selectedDateIso]);

  // Filtered attendance records with search and status
  const filteredRecords = useMemo(() => {
    return recordsForDate.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.nik && item.nik.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.role && item.role.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchStatus = statusFilter === 'Semua' || 
                          (statusFilter === 'Tepat Waktu' && item.status === 'Tepat Waktu') ||
                          (statusFilter === 'Terlambat' && item.status === 'Terlambat') ||
                          (statusFilter === 'Belum Hadir' && item.status === 'Belum Hadir');

      return matchSearch && matchStatus;
    });
  }, [recordsForDate, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'Karyawan': return 'badge-type-karyawan';
      case 'Magang': return 'badge-type-magang';
      case 'PKL': return 'badge-type-pkl';
      default: return 'badge-type-default';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Tepat Waktu':
        return (
          <span className="status-badge status-ontime">
            <Check size={12} strokeWidth={2.5} className="status-badge-icon" />
            <span>Tepat Waktu</span>
          </span>
        );
      case 'Terlambat':
        return (
          <span className="status-badge status-late">
            <Clock size={12} strokeWidth={2.5} className="status-badge-icon" />
            <span>Terlambat</span>
          </span>
        );
      case 'Belum Hadir':
      default:
        return (
          <span className="status-badge status-absent">
            <X size={12} strokeWidth={2.5} className="status-badge-icon" />
            <span>Belum Hadir</span>
          </span>
        );
    }
  };

  // Dynamic metrics from attendanceData for the selected date
  const totalEmployees = recordsForDate.length;
  const totalHadir = recordsForDate.filter(i => i.status === 'Tepat Waktu' || i.status === 'Terlambat').length;
  const tepatWaktu = recordsForDate.filter(i => i.status === 'Tepat Waktu').length;
  const terlambat = recordsForDate.filter(i => i.status === 'Terlambat').length;
  const belumHadir = recordsForDate.filter(i => i.status === 'Belum Hadir').length;
  const percentTepatWaktu = totalHadir > 0 ? ((tepatWaktu / totalHadir) * 100).toFixed(1) : '0';
  const percentTerlambat = totalHadir > 0 ? ((terlambat / totalHadir) * 100).toFixed(1) : '0';

  // If a record is selected, show the Attendance Detail Page
  if (selectedRecord) {
    return (
      <AttendanceDetailPage 
        record={selectedRecord} 
        onBack={() => setSelectedRecord(null)} 
      />
    );
  }

  return (
    <div className="attendance-view">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Presensi Harian Karyawan</h1>
        <p className="page-subtitle">
          Pantau waktu kedatangan dan status kehadiran seluruh staf secara langsung.
        </p>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="stats-grid-4">
        {/* Card 1: Total Hadir */}
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">TOTAL HADIR</span>
            <div className="stat-value-group">
              <span className="stat-main-number">{totalHadir}</span>
              <span className="stat-sub-text">/ {totalEmployees} staf</span>
            </div>
          </div>
          <div className="stat-icon-wrapper icon-teal-bg">
            <Users size={22} className="text-teal" />
          </div>
        </div>

        {/* Card 2: Tepat Waktu */}
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">TEPAT WAKTU</span>
            <div className="stat-value-group">
              <span className="stat-main-number">{tepatWaktu}</span>
              <span className="stat-sub-text">staf ({percentTepatWaktu}%)</span>
            </div>
          </div>
          <div className="stat-icon-wrapper icon-emerald-bg">
            <Check size={22} className="text-emerald" />
          </div>
        </div>

        {/* Card 3: Terlambat */}
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">TERLAMBAT</span>
            <div className="stat-value-group">
              <span className="stat-main-number">{terlambat}</span>
              <span className="stat-sub-text">staf ({percentTerlambat}%)</span>
            </div>
          </div>
          <div className="stat-icon-wrapper icon-amber-bg">
            <Clock size={22} className="text-amber" />
          </div>
        </div>

        {/* Card 4: Belum Hadir / Cuti */}
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">BELUM HADIR / CUTI</span>
            <div className="stat-value-group">
              <span className="stat-main-number">{belumHadir}</span>
              <span className="stat-sub-text">staf</span>
            </div>
          </div>
          <div className="stat-icon-wrapper icon-slate-bg">
            <Hourglass size={22} className="text-slate" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <div className="filter-controls-left">
          {/* Interactive Date Picker with Popover Calendar */}
          <div className="datepicker-container" ref={datePickerRef}>
            <button
              type="button"
              id="filter-date-btn"
              className={`filter-dropdown-btn ${isDatePickerOpen ? 'active' : ''}`}
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              aria-expanded={isDatePickerOpen}
              aria-haspopup="dialog"
              title="Klik untuk memilih tanggal presensi"
            >
              <Calendar size={16} className="text-muted" />
              <span>{formatIndonesianDateLabel(selectedDate)}</span>
              <ChevronDown size={15} className={`dropdown-arrow ${isDatePickerOpen ? 'rotated' : ''}`} />
            </button>

            {/* Datepicker Popover Modal */}
            {isDatePickerOpen && (
              <div className="datepicker-popover" role="dialog" aria-modal="true" aria-label="Kalender Presensi">
                {/* Presets */}
                <div className="datepicker-presets">
                  <button
                    type="button"
                    className={`preset-chip ${isSameDay(selectedDate, new Date()) ? 'active' : ''}`}
                    onClick={() => handleSelectDate(new Date())}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    className={`preset-chip ${isSameDay(selectedDate, getYesterday()) ? 'active' : ''}`}
                    onClick={() => handleSelectDate(getYesterday())}
                  >
                    Kemarin
                  </button>
                  <button
                    type="button"
                    className={`preset-chip ${selectedDate.getDate() === 14 && selectedDate.getMonth() === 9 && selectedDate.getFullYear() === 2026 ? 'active' : ''}`}
                    onClick={() => handleSelectDate(new Date(2026, 9, 14))}
                  >
                    14 Okt 2026
                  </button>
                </div>

                {/* Calendar Header */}
                <div className="datepicker-header">
                  <button
                    type="button"
                    className="calendar-nav-btn"
                    onClick={handlePrevMonth}
                    title="Bulan Sebelumnya"
                    aria-label="Bulan Sebelumnya"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="calendar-month-year">
                    <span className="month-name">{INDO_MONTHS[viewMonth]}</span>
                    <span className="year-name">{viewYear}</span>
                  </div>
                  <button
                    type="button"
                    className="calendar-nav-btn"
                    onClick={handleNextMonth}
                    title="Bulan Berikutnya"
                    aria-label="Bulan Berikutnya"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Weekdays Row */}
                <div className="calendar-weekdays">
                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
                    <div key={day} className="weekday-col">{day}</div>
                  ))}
                </div>

                {/* Day Grid */}
                <div className="calendar-grid">
                  {calendarCells.map((cell, idx) => {
                    const isSelected = cell.isCurrentMonth &&
                      selectedDate.getDate() === cell.day &&
                      selectedDate.getMonth() === viewMonth &&
                      selectedDate.getFullYear() === viewYear;

                    const today = new Date();
                    const isToday = cell.isCurrentMonth &&
                      today.getDate() === cell.day &&
                      today.getMonth() === viewMonth &&
                      today.getFullYear() === viewYear;

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!cell.isCurrentMonth}
                        className={`calendar-day-btn ${!cell.isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                        onClick={() => {
                          if (cell.isCurrentMonth) {
                            handleSelectDate(new Date(viewYear, viewMonth, cell.day));
                          }
                        }}
                      >
                        <span className="day-number">{cell.day}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Footer direct input */}
                <div className="datepicker-footer">
                  <div className="direct-date-input-group">
                    <label htmlFor="direct-date-input" className="direct-date-label">Pilih Tanggal:</label>
                    <input
                      id="direct-date-input"
                      type="date"
                      className="direct-date-input"
                      value={selectedDateIso}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-').map(Number);
                          handleSelectDate(new Date(y, m - 1, d));
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-datepicker-close"
                    onClick={() => setIsDatePickerOpen(false)}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status Dropdown Filter */}
          <div className="filter-select-wrapper">
            <select
              id="filter-status-select"
              className="custom-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="Semua">Semua Status</option>
              <option value="Tepat Waktu">Tepat Waktu</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Belum Hadir">Belum Hadir</option>
            </select>
            <Filter size={14} className="select-trailing-icon" />
          </div>
        </div>

        {/* Search Input */}
        <div className="search-input-wrapper">
          <Search size={16} className="search-leading-icon" />
          <input
            id="search-attendance"
            type="text"
            className="search-input"
            placeholder="Cari nama karyawan..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Attendance Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th className="th-employee">KARYAWAN</th>
                <th className="th-type">TIPE</th>
                <th className="th-dept">DIVISI &amp; PERAN</th>
                <th className="th-time">JAM DATANG</th>
                <th className="th-status">STATUS ABSEN</th>
                <th className="th-action">TINDAKAN</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((item) => (
                  <tr key={item.id} className="table-row-hover">
                    {/* Karyawan Profile */}
                    <td>
                      <div className="employee-cell">
                        {item.avatar ? (
                          <img 
                            src={item.avatar} 
                            alt={item.name} 
                            className="table-avatar"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/avatars/default_avatar.png';
                            }}
                          />
                        ) : (
                          <div className="emp-initials-badge">
                            {item.initials || (item.name ? item.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'EM')}
                          </div>
                        )}
                        <div className="employee-name-col">
                          <span className="employee-name">{item.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Tipe Badge */}
                    <td>
                      <span className={`type-badge ${getTypeBadgeClass(item.type)}`}>
                        {item.type}
                      </span>
                    </td>

                    {/* Divisi & Peran */}
                    <td>
                      <div className="dept-cell">
                        <span className="dept-name">{item.department}</span>
                        <span className="role-name">{item.role}</span>
                      </div>
                    </td>

                    {/* Jam Datang */}
                    <td>
                      <div className="time-cell">
                        {item.checkInTime !== '—' && <Clock size={14} className="time-icon" />}
                        <span className="time-text">{item.checkInTime}</span>
                      </div>
                    </td>

                    {/* Status Absen */}
                    <td>
                      {getStatusBadge(item.status)}
                    </td>

                    {/* Tindakan (Eye detail) */}
                    <td>
                      <button 
                        className="btn-action-icon"
                        onClick={() => setSelectedRecord(item)}
                        title={`Lihat detail presensi ${item.name}`}
                        aria-label={`Detail ${item.name}`}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center empty-state-cell">
                    Belum ada data presensi pada {formatIndonesianDateLabel(selectedDate)}. Data akan ditampilkan otomatis setelah terhubung ke database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        <div className="pagination-bar">
          <div className="pagination-summary">
            Menampilkan <span className="font-semibold">{paginatedRecords.length > 0 ? `1–${paginatedRecords.length}` : '0'}</span> dari <span className="font-semibold">{filteredRecords.length}</span> karyawan
          </div>

          <div className="pagination-controls">
            <button 
              className="pagination-btn-arrow"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              <ChevronLeft size={16} />
              <span>Sebelumnya</span>
            </button>

            <div className="pagination-pages">
              <button 
                className={`page-num-btn active`}
                onClick={() => setCurrentPage(1)}
              >
                1
              </button>
            </div>

            <button 
              className="pagination-btn-arrow"
              disabled={currentPage >= totalPages || filteredRecords.length === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <span>Selanjutnya</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
