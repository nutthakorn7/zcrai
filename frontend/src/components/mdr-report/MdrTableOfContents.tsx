import { MdrPageFooter } from './MdrPageFooter'

interface MdrTableOfContentsProps {
  data: any // Using specific type would be better but avoiding circular deps for now
}

/**
 * Table of Contents
 */
export function MdrTableOfContents({ data }: MdrTableOfContentsProps) {
  // Calculate page counts dynamically
  const startPage = 3 // Cover (1) + TOC (2) -> Overview starts on 3
  
  // 1. Overview: 3 Pages (Bar Chart + Pie Chart + Top Lists)
  const overviewPages = 3
  
  // 2. Incident Detail
  // 8 incidents per page + 1 recommendation page
  const incidentCount = data?.incidents?.length || 0
  const incidentPerPage = 8
  const incidentListPages = Math.max(1, Math.ceil(incidentCount / incidentPerPage))
  const incidentPages = incidentListPages + 1
  
  // 3. Risk Assessment: 1 Page
  const riskPages = 1
  
  // 4. Vulnerability
  // Apps: 8 per page
  // Endpoints: 8 per page
  // Recommendation: 1 page
  const vulnContentPerPage = 8
  const appCount = data?.vulnerabilities?.appsByVulnerabilities?.length || 0
  const endpointCount = data?.vulnerabilities?.endpointsByVulnerabilities?.length || 0
  
  const vulnAppPages = Math.max(1, Math.ceil(appCount / vulnContentPerPage))
  const vulnEndpointPages = Math.max(1, Math.ceil(endpointCount / vulnContentPerPage))
  const vulnPages = vulnAppPages + vulnEndpointPages + 1
  
  // 5. Data Leak
  const dataLeakPerPage = 8
  const dataLeakCount = data?.dataLeaks?.length || 0
  const dataLeakPages = Math.max(1, Math.ceil(dataLeakCount / dataLeakPerPage))
  
  // 6. Network
  const networkPerPage = 8
  const networkCount = data?.networkActivity?.topTalkers?.length || 0
  const networkPages = Math.max(1, Math.ceil(networkCount / networkPerPage))
  
  // Calculate starting pages
  const pOverview = startPage
  const pIncidents = pOverview + overviewPages
  const pRisk = pIncidents + incidentPages
  const pVuln = pRisk + riskPages
  const pDataLeak = pVuln + vulnPages
  const pNetwork = pDataLeak + dataLeakPages
  const pAppendix = pNetwork + networkPages

  const sections = [
    { number: '1', title: 'Executive Overview', page: pOverview },
    { number: '1.1', title: 'Top Classifications', page: pOverview + 1 },
    { number: '1.2', title: 'Top Security Incidents & Threats', page: pOverview + 2 },
    { number: '2', title: 'Incident Detail', page: pIncidents },
    { number: '2.1', title: 'Detailed Threat Analysis', page: pIncidents },
    { number: '2.2', title: 'Incident Recommendation', page: pIncidents + incidentListPages },
    { number: '3', title: 'Risk Assessment', page: pRisk },
    { number: '4', title: 'Vulnerability Application', page: pVuln },
    { number: '4.1', title: 'Application Vulnerabilities', page: pVuln },
    { number: '4.2', title: 'Endpoint Vulnerabilities', page: pVuln + vulnAppPages },
    { number: '4.3', title: 'Vulnerability Recommendation', page: pVuln + vulnAppPages + vulnEndpointPages },
    { number: '5', title: 'Data Leak Detection', page: pDataLeak },
    { number: '6', title: 'Network Activity', page: pNetwork },
    { number: '7', title: 'Appendix (Glossary)', page: pAppendix },
  ]
  
  return (
    <div className="mdr-page mdr-toc-page">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-lime-500 text-white py-4 px-8">
          <h1 className="text-2xl font-bold">Table of Contents</h1>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-6 flex flex-col justify-center">
          <div className="max-w-3xl mx-auto w-full">
            <table className="w-full text-sm">
              <tbody>
                {sections.map((section, index) => (
                  <tr 
                    key={index}
                    className={`border-b border-gray-100 ${
                      !section.number.includes('.') ? 'font-bold text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <td className={`py-2 px-4 ${!section.number.includes('.') ? 'text-lime-700' : ''} w-16`}>
                      {section.number}
                    </td>
                    <td className="py-2 px-2">
                       {section.title}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-gray-500 w-16">
                      {section.page}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Footer */}
        <MdrPageFooter />
      </div>
    </div>
  )
}
