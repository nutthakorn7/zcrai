// Note: Replace with actual Monster Connect logo when available
// import monsterConnectLogo from '../../assets/logo/mc-logo.png'

interface MdrCoverPageProps {
  tenantName: string
  monthYear: string
  dateRange: { start: string; end: string }
}

/**
 * Cover Page - First page of the MDR Report
 * Matches the Monster Connect branding with Lime Green accent
 */
export function MdrCoverPage({ tenantName, monthYear, dateRange }: MdrCoverPageProps) {
  // Format month name in Thai
  const formatMonthYear = (my: string) => {
    const [year, month] = my.split('-')
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 
      'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
      'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ]
    const thaiYear = parseInt(year) + 543
    return `${monthNames[parseInt(month) - 1]} ${thaiYear}`
  }
  
  // Format date range
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    return `${startDate.toLocaleDateString('th-TH', options)} - ${endDate.toLocaleDateString('th-TH', options)}`
  }
  
  return (
    <div className="mdr-page mdr-cover-page">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 w-[600px] h-[600px] rounded-full bg-lime-500/10" />
        <div className="absolute -left-20 bottom-20 w-[400px] h-[400px] rounded-full bg-lime-500/5" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Top: Logo */}
        <div className="flex justify-between items-start p-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-lime-500 rounded-lg flex items-center justify-center">
              <span className="text-2xl text-white font-bold">MC</span>
            </div>
            <div>
              <p className="font-bold text-lime-600">MONSTER CONNECT</p>
              <p className="text-xs text-gray-500">Managed Security Services</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>MDR Monthly Report</p>
            <p>Confidential</p>
          </div>
        </div>
        
        {/* Center: Title */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Managed Detection & Response
          </h1>
          <h2 className="text-3xl font-semibold text-lime-600 mb-8">
            Monthly Security Report
          </h2>
          
          {/* Client Name */}
          <div className="bg-lime-500 text-white px-12 py-4 rounded-lg mb-8">
            <p className="text-2xl font-bold">{tenantName}</p>
          </div>
          
          {/* Period */}
          <div className="text-xl text-gray-600">
            <p className="font-semibold">รายงานประจำเดือน</p>
            <p className="text-2xl text-gray-900 font-bold mt-2">
              {formatMonthYear(monthYear)}
            </p>
            <p className="text-sm mt-2 text-gray-500">
              ({formatDateRange(dateRange.start, dateRange.end)})
            </p>
          </div>
        </div>
        
        {/* Bottom: Footer */}
        <div className="p-8 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <p>© Monster Connect Co., Ltd.</p>
            <p>www.monsterconnect.co.th</p>
          </div>
        </div>
      </div>
    </div>
  )
}
