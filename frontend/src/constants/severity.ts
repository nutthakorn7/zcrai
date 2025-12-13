export const SEVERITY_COLORS = {
  critical: {
    bg: 'bg-red-500',
    text: 'text-red-500',
    border: 'border-red-500',
    dot: '#EF4444',
    label: 'Critical'
  },
  high: {
    bg: 'bg-orange-500',
    text: 'text-orange-500',
    border: 'border-orange-500',
    dot: '#F97316',
    label: 'High'
  },
  medium: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-500',
    border: 'border-yellow-500',
    dot: '#EAB308',
    label: 'Medium'
  },
  low: {
    bg: 'bg-blue-500',
    text: 'text-blue-500',
    border: 'border-blue-500',
    dot: '#3B82F6',
    label: 'Low'
  },
  info: {
    bg: 'bg-gray-400',
    text: 'text-gray-400',
    border: 'border-gray-400',
    dot: '#9CA3AF',
    label: 'Info'
  }
} as const;

export type SeverityLevel = keyof typeof SEVERITY_COLORS;

export const getSeverityColor = (severity: string) => {
  const level = severity.toLowerCase() as SeverityLevel;
  return SEVERITY_COLORS[level] || SEVERITY_COLORS.info;
};

export const getSeverityDotSize = (severity: string) => {
  const sizes = {
    critical: 16,
    high: 14,
    medium: 12,
    low: 10,
    info: 8
  };
  const level = severity.toLowerCase() as SeverityLevel;
  return sizes[level] || 8;
};
