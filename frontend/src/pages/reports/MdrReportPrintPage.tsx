import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../shared/api/api'
import { mockMdrReportData, MOCK_REPORT_ID } from '../../mocks/mdr-report.mock'

// Import MDR Report Components
import {
  MdrCoverPage,
  MdrTableOfContents,
  MdrOverviewSection,
  MdrIncidentDetailSection,
  MdrRiskAssessmentSection,
  MdrVulnerabilitySection,
  MdrAppendixSection,
  MdrContactPage
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
  incidents: Array<{
    status: 'resolved' | 'pending' | 'mitigated'
    threatDetails: string
    confidenceLevel: string
    endpoint: string
    classification: string
    hash: string
    path: string
  }>
  incidentRecommendation: string
  riskAssessment: {
    result: string
    recommendation: string
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
  glossary: Array<{ term: string; definition: string }>
}

/**
 * MDR Report Print Page
 * This is a special route designed for PDF generation via Puppeteer
 * It renders the full report without any navigation or sidebar
 * 
 * Usage:
 * - /report-print/demo - Shows mock data for testing
 * - /report-print/:id - Fetches real report data from API
 */
export default function MdrReportPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MdrReportData | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!id) return
    
    // Use mock data if ID is 'demo' or matches mock ID
    if (id === 'demo' || id === MOCK_REPORT_ID) {
      setData(mockMdrReportData)
      setLoading(false)
      return
    }
    
    async function fetchReport() {
      try {
        const response = await api.get(`/mdr-reports/${id}`)
        if (response.data?.success && response.data?.data?.reportData) {
          setData(response.data.data.reportData)
        } else {
          // Fallback to mock data if API returns empty
          console.warn('No report data from API, using mock data')
          setData(mockMdrReportData)
        }
      } catch (err) {
        console.error('Failed to fetch report:', err)
        // Fallback to mock data on error (for development/demo)
        console.warn('API failed, using mock data for demo purposes')
        setData(mockMdrReportData)
      } finally {
        setLoading(false)
      }
    }
    
    fetchReport()
  }, [id])
  
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
        // companyLogo="/logo/provider.png" // Example: Add logic to fetch real logo if available
        // customerLogo="/logo/customer.png" 
      />
      
      {/* Page 2: Table of Contents & Overview */}
      <div className="mdr-page relative flex flex-col min-h-[1123px] bg-white text-gray-900">
          {/* Header */}
          <div className="absolute top-8 right-8 text-right">
             <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Confidential</div>
             <div className="text-[10px] text-gray-300">MDR Monthly Report</div>
          </div>

          <div className="p-16 pt-20 flex-1">
            <MdrTableOfContents />
            
            <div className="mt-12">
               <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-lime-500 inline-block pb-2">
                 1. Executive Overview
               </h2>
               <MdrOverviewSection 
                  overview={data.overview}
                  topEndpoints={data.topEndpoints}
                  topThreats={data.topThreats}
                />
            </div>
          </div>
          
           {/* Footer */}
           <div className="absolute bottom-8 left-0 w-full text-center">
             <div className="border-t border-gray-100 mx-16 pt-3">
                <p className="text-[10px] text-gray-400">Monster Connect | Managed Security Services</p>
             </div>
           </div>
      </div>
      
      {/* Page 3: Incident Detail */}
      <div className="mdr-page relative flex flex-col min-h-[1123px] bg-white text-gray-900">
          {/* Header */}
          <div className="absolute top-8 right-8 text-right">
             <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Confidential</div>
          </div>

          <div className="p-16 pt-20 flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-lime-500 inline-block pb-2">
                 2. Incident Details
            </h2>
            <MdrIncidentDetailSection 
              incidents={data.incidents}
              recommendation={data.incidentRecommendation}
            />
          </div>

           {/* Footer */}
           <div className="absolute bottom-8 left-0 w-full text-center">
             <div className="border-t border-gray-100 mx-16 pt-3">
                <p className="text-[10px] text-gray-400">Monster Connect | Managed Security Services</p>
             </div>
           </div>
      </div>
      
      {/* Page 4: Risk Assessment & Vulnerability */}
      <div className="mdr-page relative flex flex-col min-h-[1123px] bg-white text-gray-900">
          {/* Header */}
          <div className="absolute top-8 right-8 text-right">
             <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Confidential</div>
          </div>

          <div className="p-16 pt-20 flex-1 space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-lime-500 inline-block pb-2">
                  3. Risk Assessment
              </h2>
              <MdrRiskAssessmentSection 
                result={data.riskAssessment.result}
                recommendation={data.riskAssessment.recommendation}
              />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-lime-500 inline-block pb-2">
                  4. Vulnerability Application
              </h2>
              <MdrVulnerabilitySection 
                appsByVulnerabilities={data.vulnerabilities.appsByVulnerabilities}
                endpointsByVulnerabilities={data.vulnerabilities.endpointsByVulnerabilities}
                recommendation={data.vulnerabilities.recommendation}
              />
            </div>
          </div>

           {/* Footer */}
           <div className="absolute bottom-8 left-0 w-full text-center">
             <div className="border-t border-gray-100 mx-16 pt-3">
                <p className="text-[10px] text-gray-400">Monster Connect | Managed Security Services</p>
             </div>
           </div>
      </div>
      
      {/* Page 5: Appendix */}
      <div className="mdr-page relative flex flex-col min-h-[1123px] bg-white text-gray-900">
          <div className="p-16 pt-20 flex-1">
             <MdrAppendixSection 
                glossary={data.glossary}
              />
              <div className="mt-12">
                 <MdrContactPage />
              </div>
          </div>
          
           {/* Footer */}
           <div className="absolute bottom-8 left-0 w-full text-center">
             <div className="border-t border-gray-100 mx-16 pt-3">
                <p className="text-[10px] text-gray-400">Monster Connect | Managed Security Services</p>
             </div>
           </div>
      </div>
    </div>
  )
}
