/**
 * Table of Contents
 */
export function MdrTableOfContents() {
  const sections = [
    { number: '1', title: 'Overview Incident Report', page: 4 },
    { number: '1.1', title: 'Top Security Incidents by Endpoint', page: 4 },
    { number: '1.2', title: 'Top Threats Detected', page: 5 },
    { number: '2', title: 'Incident Detail', page: 6 },
    { number: '2.1', title: 'Detailed Threat Analysis', page: 6 },
    { number: '2.2', title: 'Recommendation', page: 7 },
    { number: '3', title: 'Risk Assessment', page: 8 },
    { number: '3.1', title: 'Assessment Result', page: 8 },
    { number: '3.2', title: 'Strategic Recommendation', page: 8 },
    { number: '4', title: 'Vulnerability Application', page: 9 },
    { number: '4.1', title: 'Application Vulnerabilities', page: 9 },
    { number: '4.2', title: 'Endpoint Vulnerabilities', page: 10 },
    { number: '4.3', title: 'Vulnerability Recommendation', page: 10 },
    { number: '5', title: 'Appendix', page: 11 },
    { number: '5.1', title: 'Glossary', page: 11 },
  ]
  
  return (
    <div className="mdr-page mdr-toc-page">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-lime-500 text-white py-6 px-8">
          <h1 className="text-3xl font-bold">Table of Contents</h1>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-8">
          <div className="max-w-2xl mx-auto">
            <table className="w-full">
              <tbody>
                {sections.map((section, index) => (
                  <tr 
                    key={index}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      !section.number.includes('.') ? 'font-bold' : ''
                    }`}
                  >
                    <td className="py-3 pr-4 text-lime-600 w-12">
                      {section.number}
                    </td>
                    <td className="py-3">
                      <span className={section.number.includes('.') ? 'ml-4' : ''}>
                        {section.title}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-500 w-16">
                      {section.page}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 text-center text-sm text-gray-400 border-t">
          Page 3
        </div>
      </div>
    </div>
  )
}
