import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../shared/api/api'

// Import MDR Report Components
import {
  MdrCoverPage,
  MdrTableOfContents,
  MdrOverviewSection,
  MdrIncidentDetailSection,
  MdrRiskAssessmentSection,
  MdrVulnerabilitySection,
  MdrDataLeakSection,
  MdrNetworkActivitySection,
  MdrAppendixSection,
  MdrContactPage,
  MdrPageFooter
} from '../../components/mdr-report'

// Report data type
interface MdrReportData {
  tenantId: string
  tenantName: string
  monthYear: string
  dateRange: { start: string; end: string }
  generatedAt: string
  overview: {
    threats: number
    mitigated: number
    malicious: number
    suspicious: number
    benign: number
    notMitigated: number
  }
  topEndpoints: Array<{ name: string; count: number }>
  topThreats: Array<{ name: string; count: number }>
  classifications: Array<{ name: string; count: number }>
  incidents: Array<{
    status: 'mitigated' | 'not_mitigated' | 'benign' | 'pending'
    threatDetails: string
    confidenceLevel: string
    endpoint: string
    classification: string
    hash: string
    path: string
    ipAddress: string
  }>
  incidentRecommendation: string
  riskAssessment: {
    result: string
    recommendation: string
    riskyFiles: Array<{
      endpoint: string
      ipAddress: string
      path: string
    }>
  }
  vulnerabilities: {
    appsByVulnerabilities: Array<{
      application: string
      cveCount: number
      topCve: string
      highestSeverity: string
      description: string
    }>
    endpointsByVulnerabilities: Array<{
      application: string
      highestSeverity: string
      endpointCount: number
      topEndpoints: string
    }>
    recommendation: string
  }
  dataLeaks: Array<{
    source: string
    dataType: string
    risk: string
    status: string
  }>
  networkActivity: {
    inbound: string
    outbound: string
    topTalkers: Array<{
      ip: string
      bandwidth: string
    }>
  }
  glossary: Array<{ term: string; definition: string }>
}

/**
 * MDR Report Print Page
 * This is a special route designed for PDF generation via Playwright
 * It renders the full report without any navigation or sidebar
 * 
 * Usage:
 * - /report-print/:id - Fetches real report data from API
 */
export default function MdrReportPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MdrReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchReport = async () => {
      if (!id) return

      try {
        setLoading(true)
        const response = await api.get(`/mdr-reports/${id}`)
        
        // Handle nested API response structure: { success: true, data: { reportData: {...} } }
        if (response.data?.success && response.data?.data?.reportData) {
          setData(response.data.data.reportData)
        } else if (response.data?.reportData) {
          // Alternative structure: { reportData: {...} }
          setData(response.data.reportData)
        } else if (response.data?.success === false) {
          // API returned error
          setError(response.data.error || 'Failed to load report data')
        } else if (response.data) {
          // Direct data structure
          setData(response.data)
        } else {
          setError('Invalid report data format')
          console.error('Invalid API response:', response)
        }
      } catch (err: any) {
        console.error('Failed to load report:', err)
        // Extract error message from API response if available
        const apiError = err.response?.data?.error
        setError(apiError || 'Failed to load report data')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id])

  // 🔥 Auto-print when data is ready (triggered by ?autoprint=true)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const shouldAutoPrint = urlParams.get('autoprint') === 'true'
    
    if (data && !loading && shouldAutoPrint) {
      const timer = setTimeout(() => {
        // Set document title for the PDF filename
        document.title = `MDR_Report_${data.monthYear}`
        window.print()
        // Optional: auto-close after print (commented out as user may cancel)
        // window.close()
      }, 2000) // Wait 2 seconds for charts to finish rendering

      return () => clearTimeout(timer)
    }
  }, [data, loading])
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md border border-red-100 max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Unable to Load Report</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // No data state (should rarely happen with mock fallback)
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center text-gray-600">
          <p className="text-xl font-bold mb-2">Loading...</p>
          <p>Preparing report data</p>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className="mdr-print-container print:bg-white bg-gray-100 min-h-screen"
      data-report-ready="true"
    >
      {/* Page 1: Cover */}
      <MdrCoverPage 
        tenantName={data.tenantName}
        monthYear={data.monthYear}
        dateRange={data.dateRange}
      />
      
      {/* Page 2: Table of Contents */}
      <MdrTableOfContents data={data} />
      
      {/* Page 3-4: Overview Section (has its own pages) */}
      <MdrOverviewSection 
        overview={data.overview}
        topEndpoints={data.topEndpoints}
        topThreats={data.topThreats}
        classifications={data.classifications || []}
      />
      
      {/* Page 5+: Incident Details (has its own pages) */}
      <MdrIncidentDetailSection 
        incidents={data.incidents}
        recommendation={data.incidentRecommendation}
      />
      
      {/* Page: Risk Assessment */}
      <MdrRiskAssessmentSection 
        result={data.riskAssessment.result}
        recommendation={data.riskAssessment.recommendation}
        riskyFiles={data.riskAssessment.riskyFiles || []}
      />
      
      {/* Page: Vulnerability (has multiple pages) */}
      <MdrVulnerabilitySection 
        appsByVulnerabilities={data.vulnerabilities.appsByVulnerabilities}
        endpointsByVulnerabilities={data.vulnerabilities.endpointsByVulnerabilities}
        recommendation={data.vulnerabilities.recommendation}
      />
      
      {/* Page: Data Leak */}
      <MdrDataLeakSection dataLeaks={data.dataLeaks} />
      
      {/* Page: Network Activity */}
      <MdrNetworkActivitySection networkActivity={data.networkActivity} />
      
      {/* Page: Appendix */}
      <MdrAppendixSection glossary={data.glossary} />
      
      {/* Page: Contact */}
      <MdrContactPage />
    </div>
  )
}
