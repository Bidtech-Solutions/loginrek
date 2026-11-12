/**
 * Token warna brand SapaKerja — biru kehijauan (teal).
 * Sumber kebenaran: docs/DESIGN.md (di root repo). Samakan dengan dashboard (src/index.css).
 */
export const colors = {
  primary: '#0E7C86',
  primaryDark: '#0A5E66',
  primaryLight: '#E6F4F5',
  accent: '#14B8A6',

  background: '#F7FAFA',
  surface: '#FFFFFF',
  text: '#0F1F24',
  textMuted: '#5B6B70',
  border: '#D9E3E5',

  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, full: 999 } as const;
