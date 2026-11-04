// Origin backend. Kosongkan VITE_API_URL ("") agar request relatif ke host yang sama (reverse proxy).
export const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';
export const API_BASE = `${API_ORIGIN}/api/v1`;
