import { MdrPageFooter } from './MdrPageFooter'

interface Incident {
  status: 'mitigated' | 'not_mitigated' | 'benign' | 'pending'
  threatDetails: string
  confidenceLevel: string
  endpoint: string
  classification: string
  hash: string
  path: string
  ipAddress: string
}

interface MdrIncidentDetailSectionProps {
  incidents: Incident[]
  recommendation: string
}

/**
 * Incident Detail Section
 * Shows detailed table of incidents and recommendation
 */
export function MdrIncidentDetailSection({ incidents, recommendation }: MdrIncidentDetailSectionProps) {
  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'mitigated':
        return 'bg-lime-100 text-lime-800'
      case 'not_mitigated':
        return 'bg-red-100 text-red-800'
      case 'benign':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }
  
  // Format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case 'mitigated': return 'Mitigated'
      case 'not_mitigated': return 'Not Mitigated'
      case 'benign': return 'Benign'
      case 'pending': return 'Pending'
      default: return status
    }
  }
  
  // Chunk incidents into pages (max 10 per page - reduced for full data display)
  const incidentsPerPage = 9
  const pages: Incident[][] = []
  for (let i = 0; i < incidents.length; i += incidentsPerPage) {
    pages.push(incidents.slice(i, i + incidentsPerPage))
  }
  
  // If no incidents, show one empty page
  if (pages.length === 0) {
    pages.push([])
  }
  
  return (
    <>
      {/* Incident Tables */}
      {pages.map((pageIncidents, pageIndex) => (
        <div key={pageIndex} className="mdr-page mdr-incident-detail-page">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-lime-500 text-white py-4 px-8">
              <h1 className="text-2xl font-bold">
                2. Incident Detail {pages.length > 1 ? `(${pageIndex + 1}/${pages.length})` : ''}
              </h1>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-6 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-white text-xs">
                  <tr>
                    <th className="py-2 px-2 text-left w-[10%]">Status</th>
                    <th className="py-2 px-2 text-left w-[15%]">Threat Details</th>
                    <th className="py-2 px-2 text-center w-[8%]">Confidence</th>
                    <th className="py-2 px-2 text-left w-[10%]">Endpoint</th>
                    <th className="py-2 px-2 text-left w-[10%]">IP Address</th>
                    <th className="py-2 px-2 text-left w-[10%]">Class.</th>
                    <th className="py-2 px-2 text-left w-[17%]">Hash</th>
                    <th className="py-2 px-2 text-left w-[20%]">Path</th>
                  </tr>
                </thead>
                <tbody>
                  {pageIncidents.map((incident, index) => (
                    <tr 
                      key={index} 
                      className="border-b border-gray-200"
                      style={{ breakInside: 'avoid' }}
                    >
                      {/* 1. Status */}
                      <td className="py-2 px-2 align-top">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusBadge(incident.status)}`}>
                          {formatStatus(incident.status)}
                        </span>
                      </td>
                      
                      {/* 2. Threat Details: Allow wrap */}
                      <td className="py-2 px-2 text-xs text-gray-700 align-top whitespace-normal break-words max-w-[150px]">
                        {incident.threatDetails}
                      </td>
                      
                      {/* 3. Confidence */}
                      <td className="py-2 px-2 text-xs text-center align-top uppercase">
                        {incident.confidenceLevel}
                      </td>
                      
                      {/* 4. Endpoint: Allow wrap */}
                      <td className="py-2 px-2 text-xs text-gray-700 align-top break-words max-w-[100px] font-mono">
                        {incident.endpoint}
                      </td>
                      
                      {/* 5. IP Address */}
                      <td className="py-2 px-2 text-xs text-gray-600 align-top break-all max-w-[90px] font-mono">
                        {incident.ipAddress}
                      </td>
                      
                      {/* 6. Classification */}
                      <td className="py-2 px-2 text-xs text-gray-600 align-top">
                        {incident.classification}
                      </td>
                      
                      {/* 7. Hash: Compact display */}
                      <td className="py-2 px-1 text-[9px] leading-3 text-gray-500 align-top font-mono break-all">
                        {incident.hash}
                      </td>
                      
                      {/* 8. Path: Compact display */}
                      <td className="py-2 px-1 text-[9px] leading-3 text-gray-500 align-top break-all">
                        {incident.path}
                      </td>
                    </tr>
                  ))}
                  {pageIncidents.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        No incidents recorded for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Footer */}
            <MdrPageFooter />
          </div>
        </div>
      ))}
      
      {/* Recommendation Page */}
      <div className="mdr-page mdr-incident-recommendation-page">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-lime-500 text-white py-4 px-8">
            <h1 className="text-2xl font-bold">2.2 Incident Recommendation</h1>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-8">
            <div className="bg-lime-50 border-l-4 border-lime-500 p-6 rounded-r-lg">
              <h3 className="text-lg font-semibold text-lime-800 mb-4">
                💡 Recommendation from Security Analysts
              </h3>
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {recommendation || 'No recommendations available for this period.'}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <MdrPageFooter />
        </div>
      </div>
    </>
  )
}
