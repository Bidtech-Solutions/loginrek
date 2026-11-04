import { env } from '@/config/env';

/**
 * Client HTTP tipis di atas fetch untuk REST API loginrek.
 * Semua respons sukses dari server dibungkus `{ data: ... }`.
 * Error validasi/auth berbentuk `{ errors: [{ message, field? }] }`.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public errors: { message: string; field?: string }[],
  ) {
    super(errors[0]?.message ?? `HTTP ${status}`);
  }
}

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

/** Set/clear token Bearer di memori. Persistensi: lihat src/lib/token-storage.ts. */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Dipanggil saat server menolak token yang sedang dipakai (401): kedaluwarsa / dicabut. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.requestTimeoutMs);

  try {
    const res = await fetch(`${env.apiUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && accessToken) unauthorizedHandler?.();
      const errMsg = json.message || (Array.isArray(json.errors) && json.errors[0]?.message) || res.statusText || ('HTTP ' + res.status);
      throw new ApiError(res.status, [{ message: errMsg }]);
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ---- Endpoint auth ------------------------------------------------------ */

export type User = {
  id: number;
  fullName: string | null;
  email: string;
  initials: string;
  role?: string | null;
  department?: string | null;
  employeeType?: string | null;
  avatarUrl?: string | null;
};

export const authApi = {
  login: (email: string, password: string, deviceName = 'mobile') =>
    api<{ data: { user: User; token: string; expiresAt: string | null } }>('/auth/login', {
      method: 'POST',
      body: { email, password, deviceName },
    }),
  me: () => api<{ data: User }>('/auth/me'),
  logout: () => api<{ message: string }>('/auth/logout', { method: 'POST' }),
  updateProfile: (payload: { currentPassword?: string; newPassword?: string; fullName?: string; avatarUrl?: string }) =>
    api<{ success: boolean; message: string; user?: any }>('/auth/profile', {
      method: 'PUT',
      body: payload,
    }),
};


/* ---- Endpoint attendances ----------------------------------------------- */

export type AttendanceResponse = {
  id: number;
  userId: number;
  date: string;
  clockInTime: string;
  status: string;
  isLate: boolean;
  photoPath: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number;
  officeName: string;
  isOfflineSync: boolean;
  createdAt: string;
};

export const attendanceApi = {
  getToday: () =>
    api<{
      data: {
        hasAttended: boolean;
        attendance: AttendanceResponse | null;
        serverTime: string;
        today: string;
      };
    }>('/attendances/today'),

  checkIn: (payload: {
    clockInTime: string;
    isLate?: boolean;
    photo?: string;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
    officeName?: string;
    isOfflineSync?: boolean;
    date?: string;
  }) =>
    api<{
      data: {
        message: string;
        attendance: AttendanceResponse;
      };
    }>('/attendances/check-in', {
      method: 'POST',
      body: payload,
    }),

  list: (params?: { page?: number; limit?: number; all?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.all) q.append('all', 'true');
    const qs = q.toString();
    return api<{ data: AttendanceResponse[] }>(`/attendances${qs ? `?${qs}` : ''}`);
  },
};
