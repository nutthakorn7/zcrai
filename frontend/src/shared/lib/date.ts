/**
 * Date Formatting Utilities for MDR Reports
 * All dates formatted in English (Gregorian calendar)
 */

/**
 * Format a date string to English format: "01 November 2025"
 * @param date ISO date string (e.g., "2025-11-01")
 * @returns Formatted date string
 */
export function formatReportDate(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  })
}

/**
 * Format month-year string to English format: "November 2025"
 * @param monthYear Format: "2025-11"
 * @returns Formatted month and year
 */
export function formatMonthYear(monthYear: string): string {
  const [year, month] = monthYear.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  })
}

/**
 * Format date range for display: "01 November 2025 - 30 November 2025"
 * @param start ISO date string
 * @param end ISO date string
 * @returns Formatted date range
 */
export function formatDateRange(start: string, end: string): string {
  return `${formatReportDate(start)} - ${formatReportDate(end)}`
}
