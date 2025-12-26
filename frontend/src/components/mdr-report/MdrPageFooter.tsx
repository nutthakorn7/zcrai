// Monster Connect Logo
import mcLogo from '../../assets/report/mc-logo.webp'

/**
 * Reusable Page Footer for MDR Report
 * - Logo on the left
 * - Page number on the right (uses CSS counter for dynamic numbering)
 */
export function MdrPageFooter() {
  return (
    <div className="mdr-page-footer p-4 border-t border-gray-200 flex justify-between items-center">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <img src={mcLogo} alt="Monster Connect" className="h-6 w-auto object-contain" />
        <span className="text-xs text-gray-400">Monster Connect</span>
      </div>
      
      {/* Right: Page Number - Uses CSS counter */}
      <div className="mdr-page-number text-sm text-gray-400" />
    </div>
  )
}
