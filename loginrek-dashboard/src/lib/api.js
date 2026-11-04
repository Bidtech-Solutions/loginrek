import { API_BASE } from '../config';

// Dipicu bila server menolak token (401/403) agar App kembali ke halaman login.
export const AUTH_EXPIRED_EVENT = 'loginrek:auth-expired';

const SESSION_KEYS = [
  'admin_token',
  'admin_user',
  'admin_profile',
  'loginrek_employees_cache',
  'loginrek_attendance_cache',
];

export function clearSession() {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

/**
 * fetch ke REST API dengan header Authorization otomatis.
 * Path relatif terhadap API_BASE, mis. apiFetch('/employees').
 * Respons 401/403 menghapus sesi dan memicu AUTH_EXPIRED_EVENT.
 */
export async function apiFetch(path, init = {}) {
  const token = localStorage.getItem('admin_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    clearSession();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return res;
}
