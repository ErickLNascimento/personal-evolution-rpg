/** Design tokens da identidade RPG premium (PRD, seção 7). */
export const colors = {
  background: '#101116',
  surface: '#1A1D25',
  surfaceRaised: '#232733',
  border: '#2C3140',
  primary: '#8B5CF6',
  accent: '#16C79A',
  xp: '#F5B942',
  danger: '#F2617A',
  text: '#F4F4F5',
  textSecondary: '#A1A1AA',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary, letterSpacing: 0.6 },
} as const;

/** Área mínima de toque (acessibilidade). */
export const MIN_TOUCH = 44;
