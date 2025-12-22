import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../shared/api/api'
import { mockMdrReportData, MOCK_REPORT_ID } from '../../mocks/mdr-report.mock'

// Import MDR Report Components
import {
  MdrCoverPage,
  MdrAttentionPage,
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
      className="mdr-report-print bg-white"
      data-report-ready="true"
    >
      {/* Cover Page */}
      <MdrCoverPage 
        tenantName={data.tenantName}
        monthYear={data.monthYear}
        dateRange={data.dateRange}
      />
      
      {/* Attention / Confidentiality Notice */}
      <MdrAttentionPage />
      
      {/* Table of Contents */}
      <MdrTableOfContents />
      
      {/* Section 1: Overview Incident Report */}
      <MdrOverviewSection 
        overview={data.overview}
        topEndpoints={data.topEndpoints}
        topThreats={data.topThreats}
      />
      
      {/* Section 2: Incident Detail */}
      <MdrIncidentDetailSection 
        incidents={data.incidents}
        recommendation={data.incidentRecommendation}
      />
      
      {/* Section 3: Risk Assessment */}
      <MdrRiskAssessmentSection 
        result={data.riskAssessment.result}
        recommendation={data.riskAssessment.recommendation}
      />
      
      {/* Section 4: Vulnerability Application */}
      <MdrVulnerabilitySection 
        appsByVulnerabilities={data.vulnerabilities.appsByVulnerabilities}
        endpointsByVulnerabilities={data.vulnerabilities.endpointsByVulnerabilities}
        recommendation={data.vulnerabilities.recommendation}
      />
      
      {/* Section 5: Appendix */}
      <MdrAppendixSection 
        glossary={data.glossary}
      />
      
      {/* Contact Us */}
      <MdrContactPage />
    </div>
  )
}
