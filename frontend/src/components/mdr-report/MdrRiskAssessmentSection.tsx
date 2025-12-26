import { MdrPageFooter } from './MdrPageFooter'

interface RiskyFile {
  endpoint: string
  ipAddress: string
  path: string
}

interface MdrRiskAssessmentSectionProps {
  result: string
  recommendation: string
  riskyFiles?: RiskyFile[]
}

/**
 * Risk Assessment Section
 * Shows risk analysis result, strategic recommendations, and risky files
 */
export function MdrRiskAssessmentSection({ result, recommendation, riskyFiles = [] }: MdrRiskAssessmentSectionProps) {
  // Simple markdown parser for bold text
  const renderMarkdown = (text: string) => {
    if (!text) return null
    
    // Split by ** to find bold sections
    const parts = text.split(/(\*\*.*?\*\*)/g)
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <>
      {/* Page 1: Risk Assessment Result & Recommendation */}
      <div className="mdr-page mdr-risk-assessment-page">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-lime-500 text-white py-3 px-8">
            <h1 className="text-xl font-bold">3. Risk Assessment</h1>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
            {/* Risk Level Indicator */}
            <div>
              <h3 className="text-md font-semibold text-gray-800 mb-2">
                3.1 Assessment Result
              </h3>
              
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-2xl">⚠️</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 mb-1">Risk Analysis</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {renderMarkdown(result || 'No risk assessment available for this period.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Strategic Recommendation */}
            <div className="flex-1 min-h-0">
              <h3 className="text-md font-semibold text-gray-800 mb-2">
                3.2 Strategic Recommendation
              </h3>
              
              <div className="bg-lime-50 rounded-lg p-4 border-l-4 border-lime-500 h-full overflow-hidden">
                <div className="flex items-start gap-4 h-full">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-lime-100 flex items-center justify-center">
                      <span className="text-xl">💡</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {renderMarkdown(recommendation || 'No strategic recommendations available.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Priority Action Items */}
            <div className="mt-auto">
              <h3 className="text-md font-semibold text-gray-800 mb-2">
                Priority Actions
              </h3>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                    <span className="font-semibold text-red-800 text-sm">Critical</span>
                  </div>
                  <p className="text-xs text-red-700">
                    Immediate action required for unmitigated threats
                  </p>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                    <span className="font-semibold text-amber-800 text-sm">High</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    Review suspicious activities within 24 hours
                  </p>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                    <span className="font-semibold text-blue-800 text-sm">Medium</span>
                  </div>
                  <p className="text-xs text-blue-700">
                    Schedule patching and software updates
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <MdrPageFooter />
        </div>
      </div>

      {/* Page 2: Risky Files Table (only show if there are risky files) */}
      {riskyFiles.length > 0 && (
        <div className="mdr-page mdr-risky-files-page">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-lime-500 text-white py-3 px-8">
              <h1 className="text-xl font-bold">3.3 Risky Files Detected</h1>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-6">
              <div className="border border-lime-300 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-lime-100 text-gray-800 font-bold border-b border-lime-300">
                    <tr>
                      <th className="py-3 px-4 text-left w-[20%] border-r border-lime-200">Endpoint</th>
                      <th className="py-3 px-4 text-left w-[15%] border-r border-lime-200">IP Address</th>
                      <th className="py-3 px-4 text-left w-[65%]">Path / File Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lime-200">
                    {riskyFiles.map((file, idx) => (
                      <tr key={idx} className="hover:bg-lime-50/50">
                        <td className="py-2 px-4 text-gray-700 border-r border-lime-200 align-top">
                          {file.endpoint}
                        </td>
                        <td className="py-2 px-4 text-gray-700 border-r border-lime-200 align-top font-mono text-xs">
                          {file.ipAddress}
                        </td>
                        <td className="py-2 px-4 text-gray-700 font-mono text-xs align-top break-all">
                          {file.path}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Remark */}
              <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-bold mr-1">⚠️ Remark:</span>
                  The listed items are considered potential risks because they reference files that could contain sensitive information used to access company systems, even if some items are not specifically identified as threats.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <MdrPageFooter />
          </div>
        </div>
      )}
    </>
  )
}
