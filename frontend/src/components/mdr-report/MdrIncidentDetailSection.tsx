interface Incident {
  status: 'resolved' | 'pending' | 'mitigated'
  threatDetails: string
  confidenceLevel: string
  endpoint: string
  classification: string
  hash: string
  path: string
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
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'mitigated':
        return 'bg-lime-100 text-lime-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }
  
  // Chunk incidents into pages (max 8 per page)
  const incidentsPerPage = 8
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
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="py-2 px-3 text-left">Status</th>
                    <th className="py-2 px-3 text-left">Threat Details</th>
                    <th className="py-2 px-3 text-left">Confidence</th>
                    <th className="py-2 px-3 text-left">Endpoint</th>
                    <th className="py-2 px-3 text-left">Classification</th>
                    <th className="py-2 px-3 text-left">Hash</th>
                    <th className="py-2 px-3 text-left">Path</th>
                  </tr>
                </thead>
                <tbody>
                  {pageIncidents.map((incident, index) => (
                    <tr 
                      key={index} 
                      className="border-b border-gray-200 hover:bg-gray-50"
                      style={{ breakInside: 'avoid' }}
                    >
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(incident.status)}`}>
                          {incident.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-[150px] truncate" title={incident.threatDetails}>
                        {incident.threatDetails}
                      </td>
                      <td className="py-2 px-3">
                        {incident.confidenceLevel}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs max-w-[120px] truncate">
                        {incident.endpoint}
                      </td>
                      <td className="py-2 px-3">
                        {incident.classification}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs max-w-[100px] truncate" title={incident.hash}>
                        {incident.hash?.substring(0, 12)}...
                      </td>
                      <td className="py-2 px-3 font-mono text-xs max-w-[150px] truncate" title={incident.path}>
                        {incident.path}
                      </td>
                    </tr>
                  ))}
                  {pageIncidents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        No incidents recorded for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Footer */}
            <div className="p-4 text-center text-sm text-gray-400 border-t">
              Page {6 + pageIndex}
            </div>
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
          <div className="p-4 text-center text-sm text-gray-400 border-t">
            Page {6 + pages.length}
          </div>
        </div>
      </div>
    </>
  )
}
