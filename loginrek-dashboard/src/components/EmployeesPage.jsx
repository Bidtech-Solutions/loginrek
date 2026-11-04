import React, { useState, useMemo } from 'react';
import AddEmployeePage from './AddEmployeePage';
import EditEmployeePage from './EditEmployeePage';
import { 
  Plus, 
  Users, 
  Briefcase, 
  GraduationCap, 
  BookOpen, 
  Search, 
  ChevronDown, 
  Edit3, 
  ChevronLeft, 
  ChevronRight,
  X,
  Check,
  UserPlus,
  Trash2,
  AlertTriangle
} from 'lucide-react';

export default function EmployeesPage({ employeesData, setEmployeesData }) {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'add'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('Semua');
  
  const [selectedRows, setSelectedRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    setIsDeleting(true);
    setDeleteError('');

    try {
      const emailQuery = employeeToDelete.email ? `?email=${encodeURIComponent(employeeToDelete.email)}` : '';
      const res = await fetch(`http://localhost:3333/api/v1/employees/${employeeToDelete.id}${emailQuery}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || 'Gagal menghapus karyawan dari database.');
      }

      setEmployeesData((prev) => {
        const filtered = prev.filter((e) => 
          Number(e.id) !== Number(employeeToDelete.id) &&
          (!employeeToDelete.email || e.email?.toLowerCase() !== employeeToDelete.email.toLowerCase())
        );
        try {
          localStorage.setItem('loginrek_employees_cache', JSON.stringify(filtered));
        } catch {}
        return filtered;
      });

      setSelectedRows((prev) => prev.filter((id) => Number(id) !== Number(employeeToDelete.id)));

      const deletedName = employeeToDelete.name || employeeToDelete.fullName || 'Karyawan';
      setEmployeeToDelete(null);
      setDeleteSuccessMsg(`Karyawan "${deletedName}" berhasil dihapus secara permanen dari database.`);
      setTimeout(() => setDeleteSuccessMsg(''), 4500);
    } catch (err) {
      setDeleteError(err.message || 'Terjadi kesalahan saat menghapus data.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    department: 'Engineering',
    type: 'Karyawan',
    location: 'Kantor Pusat Batam',
    phone: '',
    attendanceSummary: '22 / 22 Hari',
    lateCount: '0x',
    onTimeCount: '22x',
    status: 'Aktif'
  });

  // Filter logic
  const filteredEmployees = useMemo(() => {
    return employeesData.filter((emp) => {
      const matchSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType = selectedType === 'Semua' || emp.type === selectedType;

      return matchSearch && matchType;
    });
  }, [employeesData, searchQuery, selectedType]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage) || 1;
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Dynamic statistics calculated from employeesData
  const totalStaff = employeesData.length;
  const totalKaryawan = employeesData.filter(e => e.type === 'Karyawan').length;
  const totalMagang = employeesData.filter(e => e.type === 'Magang').length;
  const totalPKL = employeesData.filter(e => e.type === 'PKL').length;
  const percentKaryawan = totalStaff > 0 ? Math.round((totalKaryawan / totalStaff) * 100) : 0;

  // Master checkbox toggle
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(paginatedEmployees.map(emp => emp.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleToggleRow = (id) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  // Reset filter handler
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('Semua');
    setCurrentPage(1);
  };

  // Open Edit Page
  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    setViewMode('edit');
  };

  // Save Edit
  const handleSaveEdit = (e) => {
    e.preventDefault();
    setEmployeesData(prev => prev.map(emp => emp.id === editingEmployee.id ? { ...formData } : emp));
    setEditingEmployee(null);
  };

  // Handle Add Employee
  const handleSaveNew = (e) => {
    e.preventDefault();
    const initials = formData.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'EM';
    const newEmp = {
      id: Date.now(),
      ...formData,
      initials,
      joinDate: 'Hari ini'
    };
    setEmployeesData(prev => [newEmp, ...prev]);
    setIsAddModalOpen(false);
    setFormData({
      name: '',
      email: '',
      role: '',
      department: 'Engineering',
      type: 'Karyawan',
      location: 'Kantor Pusat Batam',
      phone: '',
      attendanceSummary: '22 / 22 Hari',
      lateCount: '0x',
      onTimeCount: '22x',
      status: 'Aktif'
    });
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'Karyawan': return 'badge-type-karyawan';
      case 'Magang': return 'badge-type-magang';
      case 'PKL': return 'badge-type-pkl';
      default: return 'badge-type-default';
    }
  };

  if (viewMode === 'add') {
    return (
      <AddEmployeePage 
        onBack={() => setViewMode('list')}
        onSave={(newEmp) => {
          setEmployeesData(prev => [newEmp, ...prev]);
          setViewMode('list');
        }}
      />
    );
  }

  if (viewMode === 'edit' && editingEmployee) {
    return (
      <EditEmployeePage 
        employee={editingEmployee}
        onBack={() => {
          setViewMode('list');
          setEditingEmployee(null);
        }}
        onSave={async (updatedEmp) => {
          try {
            const res = await fetch(`http://localhost:3333/api/v1/employees/${updatedEmp.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fullName: updatedEmp.name,
                role: updatedEmp.role,
                employeeType: updatedEmp.type,
                phone: updatedEmp.phone,
                avatarUrl: updatedEmp.avatar,
                password: updatedEmp.password,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok && json.employee) {
              setEmployeesData(prev => prev.map(e => e.id === updatedEmp.id ? { ...e, ...json.employee } : e));
            } else {
              setEmployeesData(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
            }
          } catch {
            setEmployeesData(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
          }
          setViewMode('list');
          setEditingEmployee(null);
        }}
        onDelete={(emp) => {
          setViewMode('list');
          setEditingEmployee(null);
          setEmployeeToDelete(emp);
        }}
      />
    );
  }

  return (
    <div className="employees-view">

      {/* Banner Notifikasi Berhasil Hapus */}
      {deleteSuccessMsg && (
        <div className="delete-success-banner">
          <Check size={16} />
          <span>{deleteSuccessMsg}</span>
          <button type="button" onClick={() => setDeleteSuccessMsg('')} className="close-banner-btn" aria-label="Tutup">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Karyawan */}
      {employeeToDelete && (
        <div className="delete-modal-overlay" onClick={() => !isDeleting && setEmployeeToDelete(null)}>
          <div className="delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon-wrapper">
              <div className="delete-modal-icon-circle">
                <Trash2 size={24} />
              </div>
            </div>

            <h3 className="delete-modal-title">Hapus Data Karyawan?</h3>
            <p className="delete-modal-desc">
              Apakah Anda yakin ingin menghapus data karyawan{' '}
              <strong>{employeeToDelete.name || employeeToDelete.fullName}</strong> ({employeeToDelete.nik || `LR-${String(employeeToDelete.id).padStart(5, '0')}`})?
            </p>
            <p className="delete-modal-subdesc">
              Akun karyawan, hak akses login di aplikasi mobile, dan seluruh riwayat presensinya akan dihapus permanen dari sistem database.
            </p>

            {deleteError && (
              <div className="delete-modal-error">
                <AlertTriangle size={15} />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="delete-modal-actions">
              <button 
                type="button"
                className="btn-delete-cancel"
                disabled={isDeleting}
                onClick={() => setEmployeeToDelete(null)}
              >
                Batal
              </button>
              <button 
                type="button"
                className="btn-delete-confirm"
                disabled={isDeleting}
                onClick={confirmDelete}
              >
                {isDeleting ? (
                  <span>Menghapus...</span>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Ya, Hapus Karyawan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header with Add Employee Button */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Data Karyawan</h1>
          <p className="page-subtitle">
            Kelola data karyawan, riwayat kehadiran, ketepatan waktu, dan informasi jabatan.
          </p>
        </div>
        <button 
          id="btn-add-employee"
          className="btn-primary-teal"
          onClick={() => setViewMode('add')}
        >
          <Plus size={18} />
          <span>Tambah Karyawan</span>
        </button>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="stats-grid-4">
        {/* Card 1: Total Staff */}
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">Total Staff</span>
            <div className="stat-value-group">
              <span className="stat-main-number">{totalStaff}</span>
            </div>
            <div className="stat-badge-pill green-pill">
              <Check size={11} strokeWidth={2.5} className="status-badge-icon" />
              <span>Aktif bekerja</span>
            </div>
          </div>
          <div className="stat-icon-wrapper icon-teal-bg">
            <Users size={22} className="text-teal" />
          </div>
        </div>

        {/* Card 2: Karyawan */}
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">Karyawan</span>
            <div className="stat-value-group">
              <span className="stat-main-number">{totalKaryawan}</span>
            </div>
            <span className="stat-sub-text">{percentKaryawan}% dari total</span>
          </div>
          <div className="stat-icon-wrapper icon-teal-light-bg">
            <Briefcase size={22} className="text-teal" />
          </div>
        </div>

        {/* Card 3: Magang */}
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">Magang</span>
            <div className="stat-value-group">
              <span className="stat-main-number">{totalMagang}</span>
            </div>
            <span className="stat-sub-text">Program aktif</span>
          </div>
          <div className="stat-icon-wrapper icon-blue-bg">
            <GraduationCap size={22} className="text-blue" />
          </div>
        </div>

        {/* Card 4: PKL */}
        <div className="stat-card">
          <div className="stat-content">
            <span className="stat-title">PKL</span>
            <div className="stat-value-group">
              <span className="stat-main-number">{totalPKL}</span>
            </div>
            <span className="stat-sub-text">Vokasi / SMK</span>
          </div>
          <div className="stat-icon-wrapper icon-cyan-bg">
            <BookOpen size={22} className="text-cyan" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="employee-filter-container">
        <div className="filter-row-top">
          {/* Search Bar */}
          <div className="search-input-wrapper-lg">
            <Search size={16} className="search-leading-icon" />
            <input
              id="search-employees"
              type="text"
              className="search-input"
              placeholder="Cari nama atau email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Tipe Dropdown */}
          <div className="filter-dropdown-select">
            <select
              id="select-type"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="Semua">Semua Tipe</option>
              <option value="Karyawan">Karyawan</option>
              <option value="Magang">Magang</option>
              <option value="PKL">PKL</option>
            </select>
            <ChevronDown size={14} className="trailing-arrow" />
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    id="checkbox-select-all"
                    aria-label="Pilih semua karyawan"
                    checked={paginatedEmployees.length > 0 && selectedRows.length === paginatedEmployees.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Nama Karyawan</th>
                <th>Role / Jabatan</th>
                <th>Tipe Pegawai</th>
                <th>Kehadiran (Bulan Ini)</th>
                <th>Terlambat</th>
                <th>Tepat Waktu</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length > 0 ? (
                paginatedEmployees.map((emp) => (
                  <tr key={emp.id} className="table-row-hover">
                    {/* Checkbox */}
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(emp.id)}
                        onChange={() => handleToggleRow(emp.id)}
                        aria-label={`Pilih ${emp.name}`}
                      />
                    </td>

                    {/* Employee Profile and Info */}
                    <td>
                      <div className="emp-profile-cell">
                        {emp.avatar ? (
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            className="emp-avatar-img"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="emp-initials-badge"
                          style={{ display: emp.avatar ? 'none' : 'flex' }}
                        >
                          {emp.initials}
                        </div>
                        <div className="emp-text-col">
                          <span className="emp-name-bold">{emp.name}</span>
                          <span className="emp-email-sub">{emp.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role / Jabatan */}
                    <td>
                      <span className="font-medium text-slate-800">{emp.role}</span>
                    </td>

                    {/* Tipe Pegawai */}
                    <td>
                      <span className={`type-badge ${getTypeBadgeClass(emp.type)}`}>
                        {emp.type}
                      </span>
                    </td>

                    {/* Kehadiran (Bulan ini) */}
                    <td>
                      <span className="attendance-pill">
                        <Check size={12} strokeWidth={2.5} className="status-badge-icon" />
                        <span>{emp.attendanceSummary}</span>
                      </span>
                    </td>

                    {/* Terlambat */}
                    <td>
                      <span className="count-pill late-count-pill">
                        {emp.lateCount}
                      </span>
                    </td>

                    {/* Tepat Waktu */}
                    <td>
                      <span className="count-pill ontime-count-pill">
                        {emp.onTimeCount}
                      </span>
                    </td>

                    {/* Aksi */}
                    <td>
                      <button 
                        type="button"
                        className="btn-edit-action"
                        onClick={() => handleOpenEdit(emp)}
                        title={`Edit ${emp.name}`}
                      >
                        <Edit3 size={14} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center empty-state-cell">
                    Belum ada data karyawan. Data akan ditampilkan otomatis setelah terhubung ke database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="pagination-bar">
          <div className="pagination-left-group">
            <span className="pagination-summary">
              Menampilkan <span className="font-semibold">{paginatedEmployees.length > 0 ? `1-${paginatedEmployees.length}` : '0'}</span> dari <span className="font-semibold">{filteredEmployees.length}</span> karyawan
            </span>

            {/* Per page selector */}
            <div className="rows-per-page-select">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={8}>8 per halaman</option>
                <option value={16}>16 per halaman</option>
                <option value={24}>24 per halaman</option>
              </select>
            </div>
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
                className="page-num-btn active"
                onClick={() => setCurrentPage(1)}
              >
                1
              </button>
            </div>

            <button 
              className="pagination-btn-arrow"
              disabled={currentPage >= totalPages || filteredEmployees.length === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <span>Selanjutnya</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Tambah Karyawan */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-card modal-form-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <UserPlus size={22} className="text-teal" />
                <h3>Tambah Data Karyawan Baru</h3>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNew}>
              <div className="modal-body form-grid">
                <div className="form-group-full">
                  <label className="form-label">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Contoh: Rian Pratama, S.Kom"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Perusahaan</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="nama@loginrek.id"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nomor Telepon / WhatsApp</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+62 812-xxxx-xxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role / Jabatan</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Contoh: Senior Backend Engineer"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Departemen</label>
                  <select
                    className="form-control"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product & Design">Product &amp; Design</option>
                    <option value="Marketing">Marketing</option>
                    <option value="HR Talent">HR Talent</option>
                    <option value="Finance & Ops">Finance &amp; Ops</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tipe Pegawai</label>
                  <select
                    className="form-control"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="Karyawan">Karyawan</option>
                    <option value="Magang">Magang</option>
                    <option value="PKL">PKL</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Lokasi Kantor</label>
                  <select
                    className="form-control"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  >
                    <option value="Kantor Pusat Batam">Kantor Pusat Batam</option>
                    <option value="Kantor Cabang Nongsa">Kantor Cabang Nongsa</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary-teal"
                >
                  Simpan Karyawan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
