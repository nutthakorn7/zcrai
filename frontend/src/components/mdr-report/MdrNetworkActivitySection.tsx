import { MdrPageFooter } from './MdrPageFooter'

interface MdrNetworkActivitySectionProps {
  networkActivity: {
    inbound: string
    outbound: string
    topTalkers: Array<{
      ip: string
      bandwidth: string
    }>
  }
}

/**
 * Network Activity Section - Section 6
 * Displays network traffic summary and top talkers
 */
export function MdrNetworkActivitySection({ networkActivity }: MdrNetworkActivitySectionProps) {
  const { inbound, outbound, topTalkers } = networkActivity
  
  // Pagination logic
  const itemsPerPage = 8
  const pages = []
  
  if (topTalkers.length === 0) {
    pages.push([])
  } else {
    for (let i = 0; i < topTalkers.length; i += itemsPerPage) {
      pages.push(topTalkers.slice(i, i + itemsPerPage))
    }
  }
  
  return (
    <>
      {pages.map((pageTalkers, pageIndex) => (
        <div key={pageIndex} className="mdr-page mdr-network-activity-page">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-lime-500 text-white py-4 px-8">
              <h1 className="text-2xl font-bold">
                6. Network Activity {pages.length > 1 ? `(${pageIndex + 1}/${pages.length})` : ''}
              </h1>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-8">
              {/* Show Summary only on first page */}
              {pageIndex === 0 && (
                <>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Network Traffic Summary
                  </h3>
                  
                  {/* Traffic Summary Cards */}
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600 uppercase tracking-wider">
                            Inbound Traffic
                          </p>
                          <p className="text-3xl font-bold text-blue-900 mt-2">
                            {inbound}
                          </p>
                        </div>
                        <div className="text-blue-400">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-600 uppercase tracking-wider">
                            Outbound Traffic
                          </p>
                          <p className="text-3xl font-bold text-green-900 mt-2">
                            {outbound}
                          </p>
                        </div>
                        <div className="text-green-400">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {/* Top Talkers Table */}
              <div>
                <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-purple-500 rounded-full mr-2" />
                  Top Network Talkers (by Bandwidth)
                </h4>
                
                {topTalkers.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <p className="text-gray-500">
                      No significant network activity detected in this period.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Rank
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            IP Address
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Total Bandwidth
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pageTalkers.map((talker, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              #{pageIndex * itemsPerPage + index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                              {talker.ip}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-purple-600">
                              {talker.bandwidth}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <MdrPageFooter />
          </div>
        </div>
      ))}
    </>
  )
}
