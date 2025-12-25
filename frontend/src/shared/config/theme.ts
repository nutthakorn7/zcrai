/**
 * Centralized theme configuration and constants for the frontend.
 */

export const SEVERITY_COLORS = {
  critical: '#FF1A1A',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
} as const;

export type SeverityType = keyof typeof SEVERITY_COLORS;

export const GET_SEVERITY_COLOR = (severity: string): string => {
  const sev = severity.toLowerCase() as SeverityType;
  return SEVERITY_COLORS[sev] || SEVERITY_COLORS.low;
};

// UI Component Colors (Matching CI Design System)
export const UI_COLORS = {
  primary: '#00d8ff',   // Cyan (CI Primary)
  secondary: '#8b5cf6', // Violet (CI Secondary)
  success: '#10b981',   // Emerald
  warning: '#f59e0b',   // Amber
  danger: '#ef4444',    // Rose
  info: '#06b6d4',      // Sky
} as const;

export const IOC_TYPE_COLORS: Record<string, string> = {
  ipv4: '#00d8ff',        // CI Primary
  ip: '#00d8ff',
  domain: '#8b5cf6',      // CI Secondary
  url: '#06b6d4',
  sha256: '#ef4444',
  md5: '#f97316',
  hash: '#ef4444',
  email: '#ec4899',
  filename: '#10b981',
  file: '#10b981',
  registry_key: '#f59e0b',
  user: '#6366f1',
  process: '#8b5cf6',
} as const;

export const DESIGN_TOKENS = {
  glassBackground: 'rgba(17, 17, 20, 0.6)',
  glassBorder: '1px solid rgba(255, 255, 255, 0.08)',
  glassBlur: 'blur(12px)',
};
