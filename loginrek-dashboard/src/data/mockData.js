// Template data structure ready for Database / API integration
export const initialAdminData = {
  name: "Admin Piposmart",
  role: "HR Operations Lead",
  email: "admin@loginrek.com",
  nip: "199204122018012003",
  avatar: "",
  lastLogin: "Hari ini, 08:30 WIB"
};

/**
 * Menghasilkan inisial nama secara dinamis (cth: "Admin Piposmart" -> "AP", "Budi Santoso" -> "BS")
 */
export const getInitials = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return 'AP';
  const nameWithoutTitles = fullName.split(',')[0].trim();
  if (!nameWithoutTitles) return 'AP';
  const words = nameWithoutTitles.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

// Data Direktori Karyawan (Kosong secara default - murni tersinkronisasi 100% dari Database Backend)
export const initialEmployeesData = [];

// Data Presensi (Kosong secara default - murni tersinkronisasi 100% dari Database Backend)
export const initialAttendanceRecords = [];
