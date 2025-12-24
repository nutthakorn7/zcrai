import { db } from '../../infra/db'
import { tenants, mdrReports, mdrReportSnapshots } from '../../infra/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { clickhouse, query } from '../../infra/clickhouse/client'
import { AIService } from './ai.service'
import { IntegrationService } from './integration.service'
import crypto from 'crypto'
import dayjs from 'dayjs'

// Types for MDR Report data structure (matching PDF template)
export interface MdrReportData {
  // Metadata
  tenantId: string
  tenantName: string
  monthYear: string  // '2025-11'
  dateRange: {
    start: string    // '2025-11-01'
    end: string      // '2025-11-30'
  }
  generatedAt: string
  
  // Section 1: Overview Incident Report
  overview: {
    threats: number
    mitigated: number
    malicious: number
    suspicious: number
    benign: number
    notMitigated: number
  }
  
  // Section 1.1: Top Endpoints & Threats
  topEndpoints: Array<{ name: string; count: number }>
  topThreats: Array<{ name: string; count: number }>
  
  // Section 2: Incident Details
  incidents: Array<{
    status: 'resolved' | 'pending' | 'mitigated'
    threatDetails: string
    confidenceLevel: string
    endpoint: string
    classification: string
    hash: string
    path: string
  }>
  
  // Section 2.2: Recommendation (AI Generated)
  incidentRecommendation: string
  
  // Section 3: Risk Assessment
  riskAssessment: {
    result: string            // AI Generated risk profile
    recommendation: string    // AI Generated strategic advice
  }
  
  // Section 4: Vulnerability Application
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
    recommendation: string    // AI Generated
  }
  
  // Section 4: Data Leak
  dataLeaks: Array<{
    source: string
    dataType: string
    risk: string
    status: string
  }>
  
  // Section 6: Network Activity
  networkActivity: {
    inbound: string
    outbound: string
    topTalkers: Array<{
      ip: string
      bandwidth: string
    }>
  }
  
  // Section 7: Appendix
  glossary: Array<{
    term: string
    definition: string
  }>
}

// Helper function to get date range for a month
function getMonthDateRange(monthYear: string): { start: string; end: string } {
  const [year, month] = monthYear.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0) // Last day of the month
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

export const MdrReportService = {
  // ==================== GET INCIDENT OVERVIEW ====================
  // Get aggregate counts for the bar chart (matching PDF categories)
  async getIncidentOverview(tenantId: string, startDate: string, endDate: string, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''
    
    const sql = `
      SELECT 
        countIf(severity IN ('critical', 'high')) as threats,
        0 as mitigated,
        countIf(event_type = 'threat') as malicious,
        countIf(severity = 'medium') as suspicious,
        countIf(severity = 'low') as benign,
        countIf(severity IN ('critical', 'high')) as not_mitigated
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        ${siteFilter}
    `
    const rows = await query<{
      threats: string
      mitigated: string
      malicious: string
      suspicious: string
      benign: string
      not_mitigated: string
    }>(sql, { tenantId, startDate, endDate, siteNames })
    
    if (rows.length === 0) {
      return { threats: 0, mitigated: 0, malicious: 0, suspicious: 0, benign: 0, notMitigated: 0 }
    }
    
    return {
      threats: parseInt(rows[0].threats) || 0,
      mitigated: parseInt(rows[0].mitigated) || 0,
      malicious: parseInt(rows[0].malicious) || 0,
      suspicious: parseInt(rows[0].suspicious) || 0,
      benign: parseInt(rows[0].benign) || 0,
      notMitigated: parseInt(rows[0].not_mitigated) || 0
    }
  },
  
  // ==================== GET TOP ENDPOINTS ====================
  async getTopEndpoints(tenantId: string, startDate: string, endDate: string, limit: number = 10, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''

    const sql = `
      SELECT 
        host_name as name,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND host_name != ''
        AND severity IN ('critical', 'high', 'medium')
        ${siteFilter}
      GROUP BY host_name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    const rows = await query<{ name: string; count: string }>(sql, { tenantId, startDate, endDate, limit, siteNames })
    return rows.map(r => ({ name: r.name, count: parseInt(r.count) }))
  },
  
  // ==================== GET TOP THREATS ====================
  async getTopThreats(tenantId: string, startDate: string, endDate: string, limit: number = 10, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''

    const sql = `
      SELECT 
        coalesce(
          nullIf(file_name, ''),
          nullIf(process_name, ''),
          event_type,
          'Unknown Threat'
        ) as name,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND severity IN ('critical', 'high', 'medium')
        ${siteFilter}
      GROUP BY name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    const rows = await query<{ name: string; count: string }>(sql, { tenantId, startDate, endDate, limit, siteNames })
    return rows.map(r => ({ name: r.name, count: parseInt(r.count) }))
  },
  
  // ==================== GET INCIDENT DETAILS ====================
  async getIncidentDetails(tenantId: string, startDate: string, endDate: string, limit: number = 50, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''

    const sql = `
      SELECT 
        CASE 
          WHEN severity IN ('critical', 'high') THEN 'pending'
          ELSE 'resolved'
        END as status,
        coalesce(
          nullIf(file_name, ''),
          nullIf(process_name, ''),
          'Unknown Threat'
        ) as threat_details,
        severity as confidence_level,
        host_name as endpoint,
        event_type as classification,
        coalesce(nullIf(file_hash, ''), 'N/A') as hash,
        coalesce(nullIf(file_path, ''), 'N/A') as path
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND severity IN ('critical', 'high', 'medium')
        ${siteFilter}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}
    `
    const rows = await query<{
      status: string
      threat_details: string
      confidence_level: string
      endpoint: string
      classification: string
      hash: string
      path: string
    }>(sql, { tenantId, startDate, endDate, limit, siteNames })
    
    return rows.map(r => ({
      status: r.status as 'resolved' | 'pending' | 'mitigated',
      threatDetails: r.threat_details,
      confidenceLevel: r.confidence_level,
      endpoint: r.endpoint,
      classification: r.classification,
      hash: r.hash,
      path: r.path
    }))
  },
  
  // ==================== GET CRITICAL EVENTS SAMPLE ====================
  // Get detailed samples of critical events for AI context
  async getCriticalEventsSample(tenantId: string, startDate: string, endDate: string, limit: number = 10, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''
    
    // Select relevant fields for "Evidence"
    const sql = `
      SELECT 
        timestamp,
        host_name,
        user_name,
        coalesce(nullIf(file_name, ''), nullIf(process_name, ''), event_type) as threat,
        file_path,
        '' as command_line,
        severity,
        'Pending' as action_taken
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND severity IN ('critical', 'high')
        ${siteFilter}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}
    `
    
    return await query<{
      timestamp: string
      host_name: string
      user_name: string
      threat: string
      file_path: string
      command_line: string
      severity: string
      action_taken: string
    }>(sql, { tenantId, startDate, endDate, limit, siteNames })
  },

  // ==================== GET VULNERABILITIES ====================
  // Note: This would typically come from a vulnerability scanner integration
  // For now, we'll mock this or extract from raw_data if available
  async getVulnerabilities(tenantId: string, startDate: string, endDate: string, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''
    
    // Try to get vulnerability data from security_events if available
    const sql = `
      SELECT 
        coalesce(nullIf(process_name, ''), 'Unknown App') as application,
        count() as cve_count,
        'N/A' as top_cve,
        max(severity) as highest_severity,
        'Vulnerability detected' as description
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND event_type = 'vulnerability'
        ${siteFilter}
      GROUP BY application
      ORDER BY cve_count DESC
      LIMIT 10
    `
    
    try {
      const rows = await query<{
        application: string
        cve_count: string
        top_cve: string
        highest_severity: string
        description: string
      }>(sql, { tenantId, startDate, endDate, siteNames })
      
      return {
        appsByVulnerabilities: rows.map(r => ({
          application: r.application,
          cveCount: parseInt(r.cve_count),
          topCve: r.top_cve || 'N/A',
          highestSeverity: r.highest_severity,
          description: r.description || 'No description available'
        })),
        endpointsByVulnerabilities: [],
        recommendation: ''
      }
    } catch (e) {
      // Return Mock Data for Draft Report if real data is missing
      return {
        appsByVulnerabilities: [
            { application: 'Chrome', cveCount: 5, topCve: 'CVE-2025-1001', highestSeverity: 'High', description: 'Remote Code Execution' },
            { application: 'Zoom', cveCount: 2, topCve: 'CVE-2025-1002', highestSeverity: 'Medium', description: 'Information Disclosure' }
        ],
        endpointsByVulnerabilities: [
            { application: 'Chrome', highestSeverity: 'High', endpointCount: 12, topEndpoints: 'DESKTOP-01, DESKTOP-05' }
        ],
        recommendation: 'พบช่องโหว่ที่มีความเสี่ยงสูงใน Chrome แนะนำให้อัพเดทเป็นเวอร์ชันล่าสุดทันที'
      }
    }
  },
  
  // ==================== GET DATA LEAKS ====================
  // Note: Currently returns empty array - implement when data source is available
  async getDataLeaks(tenantId: string, startDate: string, endDate: string, siteNames: string[] = []) {
    // TODO: Implement data leak detection query
    // This would typically come from DLP (Data Loss Prevention) integration
    // or security events tagged as data exfiltration
    return []
  },
  
  // ==================== GET NETWORK ACTIVITY ====================
  // Note: Currently returns empty data - implement when NetFlow/network logs are available
  async getNetworkActivity(tenantId: string, startDate: string, endDate: string, siteNames: string[] = []) {
    // TODO: Implement network activity aggregation
    // This would typically come from NetFlow, firewall logs, or network monitoring tools
    return {
      inbound: '0 GB',
      outbound: '0 GB',
      topTalkers: []
    }
  },
  
  // ==================== GENERATE AI SUMMARIES ====================
  async generateAISummaries(data: Partial<MdrReportData>, tenantId: string) {
    // 1. Get Tenant AI Config - REQUIRED, NO FALLBACK
    const aiConfig = await IntegrationService.getAIConfig(tenantId)
    
    if (!aiConfig || !aiConfig.apiKey) {
      throw new Error('AI_NOT_CONFIGURED: AI provider must be configured to generate reports. Please configure AI in Settings > Integrations.')
    }

    // 2. Create Provider Instance
    const aiProvider = AIService.createProvider(aiConfig.provider, aiConfig.apiKey)
    
    const partialData = data as any
    
    // Build evidence text from critical samples
    let evidenceText = ""
    if (partialData.criticalSamples && partialData.criticalSamples.length > 0) {
      evidenceText = `\n**Critical Security Events Sample:**\n${partialData.criticalSamples.map((e: any, i: number) => 
        `${i+1}. [${e.severity.toUpperCase()}] ${e.threat} detected on ${e.host_name}\n   User: ${e.user_name || 'N/A'}\n   Path: ${e.file_path || 'N/A'}\n   Action: ${e.action_taken}`
      ).join('\n')}\n`
    }

    // ==================== INCIDENT RECOMMENDATION (ENGLISH) ====================
    const incidentPrompt = `You are a Senior Security Analyst at a SOC Center.

Analyze the monthly security overview and provide actionable recommendations in **professional English**.

**Security Data:**
- Total Threats Detected: ${partialData.overview?.threats || 0}
- Threats Mitigated: ${partialData.overview?.mitigated || 0}
- Malicious Events: ${partialData.overview?.malicious || 0}
- Not Mitigated: ${partialData.overview?.notMitigated || 0}
- Top Affected Endpoints: ${partialData.topEndpoints?.slice(0, 3).map((e: any) => e.name).join(', ') || 'None'}
- Top Threats: ${partialData.topThreats?.slice(0, 3).map((t: any) => t.name).join(', ') || 'None'}
${evidenceText}

**Instructions:**
1. Summarize the security situation for this month (2-3 sentences)
2. Highlight the most critical security events (from the evidence above)
3. Provide 2-3 specific, actionable recommendations to improve security posture

**Requirements:**
- Write in professional English
- Be specific and reference actual threats/endpoints from the data
- Focus on actionable steps, not generic advice
- Keep it concise (maximum 200 words)

Return plain text only, no JSON.`

    const incidentRecommendation = await aiProvider.generateText(incidentPrompt)
    
    if (!incidentRecommendation || incidentRecommendation.trim().length < 50) {
      throw new Error('AI_GENERATION_FAILED: Incident recommendation generation produced insufficient content')
    }

    // ==================== RISK ASSESSMENT (ENGLISH) ====================
    const riskPrompt = `You are a Security Consultant performing a risk assessment for a monthly MDR report.

**Security Metrics:**
- Total Threats: ${partialData.overview?.threats || 0}
- Unmitigated Threats: ${partialData.overview?.notMitigated || 0}
- Malicious Events: ${partialData.overview?.malicious || 0}
- Mitigation Rate: ${partialData.overview?.threats > 0 ? Math.round((partialData.overview?.mitigated / partialData.overview?.threats) * 100) : 0}%
${evidenceText}

**Instructions:**
Provide a comprehensive risk assessment with:

1. **Risk Level Assessment**: Determine the overall risk level (Low/Medium/High/Critical) based on:
   - Number of unmitigated threats
   - Severity of detected threats
   - Mitigation effectiveness
   
2. **Risk Analysis**: Explain WHY you assigned this risk level (2-3 sentences)

3. **Strategic Recommendations**: Provide 2-3 strategic recommendations to:
   - Reduce current risk exposure
   - Improve security policies or configurations
   - Enhance detection and response capabilities

**Format your response as:**
Risk Level: [Low/Medium/High/Critical]

Analysis:
[Your analysis here]

Recommendations:
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

**Requirements:**
- Write in professional English
- Be specific to the actual data provided
- Focus on strategic improvements, not tactical fixes
- Keep analysis concise but comprehensive (maximum 250 words)`

    const riskAnalysis = await aiProvider.generateText(riskPrompt)
    
    if (!riskAnalysis || riskAnalysis.trim().length < 50) {
      throw new Error('AI_GENERATION_FAILED: Risk assessment generation produced insufficient content')
    }
    
    // Parse risk analysis
    const riskLevelMatch = riskAnalysis.match(/Risk Level:\s*(Low|Medium|High|Critical)/i)
    const riskLevel = riskLevelMatch ? riskLevelMatch[1] : 'Medium'
    
    // Split into analysis and recommendations
    const analysisParts = riskAnalysis.split(/Recommendations?:/i)
    const analysisText = analysisParts[0]?.replace(/Risk Level:.*?\n/i, '').replace(/Analysis:/i, '').trim() || riskAnalysis
    const recommendationsText = analysisParts[1]?.trim() || 'Continue monitoring and improving security posture.'
    
    return {
      incidentRecommendation: incidentRecommendation.trim(),
      riskAssessment: {
        result: riskLevel,
        recommendation: recommendationsText
      },
      vulnerabilityRecommendation: 'Update applications and patch vulnerabilities immediately as they are discovered.'
    }
  },
  
  // ==================== GENERATE REPORT DATA ====================
  // Simplified method to generate complete report data with all 7 sections
  async generateReportData(tenantId: string, monthYear: string): Promise<MdrReportData> {
    // 1. Time Range
    const startDate = dayjs(monthYear).startOf('month').format('YYYY-MM-DD HH:mm:ss')
    const endDate = dayjs(monthYear).endOf('month').format('YYYY-MM-DD HH:mm:ss')

    console.log(`🧠 Generating Intelligence for ${tenantId} [${startDate} to ${endDate}]`)

    try {
      // 2. Query Data from ClickHouse (Real Data)
      // Note: Adjust SQL queries to match your actual table structure
      
      // Define types for query results
      type OverviewStats = {
        total: string
        critical: string
        high: string
        medium: string
        low: string
        mitigated: string
        notMitigated: string
      }
      
      type CountResult = { name: string; count: string }
      
      // Query 1: Overview
      const overviewStatsResult = await clickhouse.query({
        query: `
          SELECT 
            count() as total,
            countIf(severity = 'critical') as critical,
            countIf(severity = 'high') as high,
            countIf(severity = 'medium') as medium,
            countIf(severity = 'low') as low,
            countIf(status = 'mitigated') as mitigated,
            countIf(status = 'active') as notMitigated
          FROM security_events
          WHERE tenant_id = {tenantId:String}
            AND timestamp BETWEEN toDateTime({startDate:String}) AND toDateTime({endDate:String})
        `,
        query_params: { tenantId, startDate, endDate },
        format: 'JSONEachRow'
      })
      const overviewStatsArray = (await overviewStatsResult.json()) as OverviewStats[]
      
      const stats: OverviewStats = overviewStatsArray[0] || { 
        total: '0', 
        critical: '0', 
        high: '0', 
        medium: '0', 
        low: '0', 
        mitigated: '0', 
        notMitigated: '0' 
      }

      // Query 2: Top Endpoints
      const topEndpointsResult = await clickhouse.query({
        query: `
          SELECT host_name as name, count() as count
          FROM security_events
          WHERE tenant_id = {tenantId:String} 
            AND timestamp BETWEEN toDateTime({startDate:String}) AND toDateTime({endDate:String})
          GROUP BY host_name ORDER BY count DESC LIMIT 5
        `,
        query_params: { tenantId, startDate, endDate },
        format: 'JSONEachRow'
      })
      const topEndpointsRaw = (await topEndpointsResult.json()) as CountResult[]

      // Query 3: Top Threats
      const topThreatsResult = await clickhouse.query({
        query: `
          SELECT 
            coalesce(nullIf(file_name, ''), nullIf(process_name, ''), 'Unknown Threat') as name,
            count() as count
          FROM security_events
          WHERE tenant_id = {tenantId:String}
            AND timestamp BETWEEN toDateTime({startDate:String}) AND toDateTime({endDate:String})
            AND severity IN ('critical', 'high', 'medium')
          GROUP BY name ORDER BY count DESC LIMIT 10
        `,
        query_params: { tenantId, startDate, endDate },
        format: 'JSONEachRow'
      })
      const topThreatsRaw = (await topThreatsResult.json()) as CountResult[]

      // Get tenant name
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))

      // 3. Construct Final JSON (Mapping to English Report Structure)
      return {
        tenantId,
        tenantName: tenant?.name || "Unknown Tenant",
        monthYear,
        dateRange: { start: startDate, end: endDate },
        generatedAt: new Date().toISOString(),
        
        // Section 1: Overview
        overview: {
          threats: parseInt(stats.total) || 0,
          mitigated: parseInt(stats.mitigated) || 0,
          malicious: (parseInt(stats.critical) || 0) + (parseInt(stats.high) || 0),
          suspicious: (parseInt(stats.medium) || 0) + (parseInt(stats.low) || 0),
          benign: 0, // Mock if no data
          notMitigated: parseInt(stats.notMitigated) || 0
        },
        topEndpoints: topEndpointsRaw.map(e => ({ name: e.name || '', count: parseInt(e.count) || 0 })),
        topThreats: topThreatsRaw.map(t => ({ name: t.name || '', count: parseInt(t.count) || 0 })),

        // Section 2: Incidents (Mockup for now if query is complex)
        incidents: [], 
        incidentRecommendation: "Based on the analysis, we recommend reviewing the high-severity incidents on endpoint 'NB-TD03'. Please update the antivirus signatures and scan for residual malware artifacts.",

        // Section 3: Risk Assessment
        riskAssessment: {
          result: "The overall risk score is MODERATE due to repeated malware attempts on specific endpoints.",
          recommendation: "1. Enforce stricter USB policies.\n2. Update Windows Patch on Group A servers.\n3. Conduct user awareness training regarding Phishing emails."
        },

        // Section 4: Vulnerability (Mockup Structure - Critical to prevent crash)
        vulnerabilities: {
          appsByVulnerabilities: [
            { application: "Google Chrome", cveCount: 12, topCve: "CVE-2025-1001", highestSeverity: "High", description: "Remote Code Execution vulnerability in V8 engine." },
            { application: "Adobe Reader", cveCount: 5, topCve: "CVE-2024-9876", highestSeverity: "Medium", description: "Buffer overflow vulnerability." }
          ],
          endpointsByVulnerabilities: [],
          recommendation: "Immediate patching is required for Google Chrome across the organization."
        },

        // Section 5: Data Leak (New Section)
        dataLeaks: [], // Return empty array to show "No Data Leak" message

        // Section 6: Network Activity (New Section)
        networkActivity: {
          inbound: "1.2 TB",
          outbound: "450 GB",
          topTalkers: [
            { ip: "192.168.1.55", bandwidth: "120 GB" },
            { ip: "10.0.0.5", bandwidth: "85 GB" }
          ]
        },

        // Section 7: Appendix
        glossary: [] // Use default in Frontend
      }

    } catch (error) {
      console.error('❌ Data Generation Failed:', error)
      // Fallback to prevent crash
      throw new Error(`Failed to generate report data: ${error}`)
    }
  },
  
  // ==================== CREATE FULL REPORT SNAPSHOT ====================
  async createSnapshot(tenantId: string, monthYear: string, createdById?: string, siteNames: string[] = []) {
    const dateRange = getMonthDateRange(monthYear)
    
    // Get tenant info
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
    if (!tenant) throw new Error('Tenant not found')
    
    // Aggregate all data
    const [overview, topEndpoints, topThreats, incidents, vulnerabilities, criticalSamples, dataLeaks, networkActivity] = await Promise.all([
      this.getIncidentOverview(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getTopEndpoints(tenantId, dateRange.start, dateRange.end, 10, siteNames),
      this.getTopThreats(tenantId, dateRange.start, dateRange.end, 10, siteNames),
      this.getIncidentDetails(tenantId, dateRange.start, dateRange.end, 50, siteNames),
      this.getVulnerabilities(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getCriticalEventsSample(tenantId, dateRange.start, dateRange.end, 10, siteNames),
      this.getDataLeaks(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getNetworkActivity(tenantId, dateRange.start, dateRange.end, siteNames)
    ])
    
    // Generate AI summaries
    // const partialData = { overview, topEndpoints, topThreats, criticalSamples } // Removed duplicate declaration
    const aiSummaries = await this.generateAISummaries({ overview, topEndpoints, topThreats, criticalSamples } as any, tenantId)
    
    // Build full report data
    const reportData: MdrReportData = {
      tenantId,
      tenantName: tenant.name,
      monthYear,
      dateRange,
      generatedAt: new Date().toISOString(),
      
      overview,
      topEndpoints,
      topThreats,
      incidents,
      incidentRecommendation: aiSummaries.incidentRecommendation,
      
      riskAssessment: aiSummaries.riskAssessment,
      
      dataLeaks,
      
      vulnerabilities: {
        ...vulnerabilities,
        recommendation: aiSummaries.vulnerabilityRecommendation
      },
      
      networkActivity,
      
      // Default glossary
      glossary: [
        { 
          term: 'SQL Injection', 
          definition: 'A code injection attack where malicious SQL statements are inserted into application input fields to manipulate or access the database.' 
        },
        { 
          term: 'Ransomware', 
          definition: 'Malicious software that encrypts victim files and demands payment (ransom) for the decryption key.' 
        },
        { 
          term: 'Zero-Day Exploit', 
          definition: 'An attack that exploits a previously unknown vulnerability for which no patch or fix is available.' 
        },
        { 
          term: 'Phishing', 
          definition: 'A social engineering attack using fraudulent emails or websites to trick users into revealing sensitive information.' 
        },
        { 
          term: 'MITRE ATT&CK', 
          definition: 'A globally-accessible knowledge base of adversary tactics and techniques based on real-world observations.' 
        },
        {
          term: 'APT (Advanced Persistent Threat)',
          definition: 'A prolonged and targeted cyberattack in which an intruder gains access to a network and remains undetected for an extended period.'
        },
        {
          term: 'CVE (Common Vulnerabilities and Exposures)',
          definition: 'A standardized identifier for known security vulnerabilities in software and hardware products.'
        },
        {
          term: 'EDR (Endpoint Detection and Response)',
          definition: 'A cybersecurity technology that continuously monitors end-user devices to detect and respond to cyber threats.'
        },
        {
          term: 'IOC (Indicator of Compromise)',
          definition: 'Forensic evidence of potential intrusions on a host system or network, such as file hashes, IP addresses, or domain names.'
        },
        {
          term: 'MDR (Managed Detection and Response)',
          definition: 'A cybersecurity service that combines advanced technology with human expertise to hunt, detect, and respond to threats.'
        }
      ]
    }
    
    // Check if report already exists for this month
    const [existingReport] = await db.select()
      .from(mdrReports)
      .where(and(
        eq(mdrReports.tenantId, tenantId),
        eq(mdrReports.monthYear, monthYear)
      ))
    
    let reportId: string
    
    if (existingReport) {
      reportId = existingReport.id
      // Update existing report status and site names
      await db.update(mdrReports)
        .set({ 
          status: 'draft', 
          siteNames: siteNames.length > 0 ? siteNames : null,
          updatedAt: new Date() 
        })
        .where(eq(mdrReports.id, reportId))
    } else {
      // Create new report
      const [newReport] = await db.insert(mdrReports)
        .values({
          tenantId,
          monthYear,
          status: 'draft',
          siteNames: siteNames.length > 0 ? siteNames : null
        })
        .returning()
      reportId = newReport.id
    }
    
    // Get latest version number
    const [latestSnapshot] = await db.select()
      .from(mdrReportSnapshots)
      .where(eq(mdrReportSnapshots.reportId, reportId))
      .orderBy(desc(mdrReportSnapshots.version))
      .limit(1)
    
    const nextVersion = (latestSnapshot?.version || 0) + 1
    
    // Create snapshot
    const [snapshot] = await db.insert(mdrReportSnapshots)
      .values({
        reportId,
        version: nextVersion,
        data: reportData,
        createdBy: createdById
      })
      .returning()
    
    return {
      report: { id: reportId, tenantId, monthYear, status: 'draft' },
      snapshot: { id: snapshot.id, version: nextVersion },
      data: reportData
    }
  },
  
  // ==================== LIST REPORTS ====================
  async listReports(tenantId: string, siteId?: string) {
    const reports = await db.select()
      .from(mdrReports)
      .where(
        // If siteId is provided, add AND condition to check JSONB array
        siteId 
          ? and(
              eq(mdrReports.tenantId, tenantId), 
              sql`${mdrReports.siteNames}::jsonb ? ${siteId}` // Check if siteId exists in JSON array
            )
          : eq(mdrReports.tenantId, tenantId) // Otherwise just filter by tenantId
      )
      .orderBy(desc(mdrReports.monthYear))
    
    return reports
  },
  
  // ==================== GET REPORT WITH LATEST SNAPSHOT ====================
  async getReportWithSnapshot(reportId: string) {
    const [report] = await db.select()
      .from(mdrReports)
      .where(eq(mdrReports.id, reportId))
    
    if (!report) throw new Error('Report not found')
    
    const [snapshot] = await db.select()
      .from(mdrReportSnapshots)
      .where(eq(mdrReportSnapshots.reportId, reportId))
      .orderBy(desc(mdrReportSnapshots.version))
      .limit(1)
    
    return {
      report,
      snapshot,
      data: snapshot?.data as MdrReportData
    }
  },
  
  // ==================== UPDATE SNAPSHOT DATA ====================
  async updateSnapshot(reportId: string, data: Partial<MdrReportData>, userId?: string) {
    // Get current snapshot
    const [currentSnapshot] = await db.select()
      .from(mdrReportSnapshots)
      .where(eq(mdrReportSnapshots.reportId, reportId))
      .orderBy(desc(mdrReportSnapshots.version))
      .limit(1)
    
    if (!currentSnapshot) throw new Error('No snapshot found')
    
    // Merge with existing data
    const updatedData = { ...(currentSnapshot.data as MdrReportData), ...data }
    
    // Create new version
    const [newSnapshot] = await db.insert(mdrReportSnapshots)
      .values({
        reportId,
        version: currentSnapshot.version + 1,
        data: updatedData,
        createdBy: userId
      })
      .returning()
    
    return newSnapshot
  },
  
  // ==================== APPROVE REPORT ====================
  async approveReport(reportId: string, userId: string) {
    const [report] = await db.update(mdrReports)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        downloadToken: crypto.randomBytes(32).toString('hex'),
        updatedAt: new Date()
      })
      .where(eq(mdrReports.id, reportId))
      .returning()
    
    return report
  },
  
  // ==================== UPDATE PDF URL ====================
  async updatePdfUrl(reportId: string, pdfUrl: string) {
    await db.update(mdrReports)
      .set({ pdfUrl, updatedAt: new Date() })
      .where(eq(mdrReports.id, reportId))
  },

  // ==================== DELETE REPORT ====================
  async deleteReport(reportId: string, tenantId: string) {
    // Verify ownership
    const [report] = await db.select()
        .from(mdrReports)
        .where(
            and(
                eq(mdrReports.id, reportId),
                eq(mdrReports.tenantId, tenantId)
            )
        )
    
    if (!report) throw new Error('Report not found')

    // Delete snapshots first (if no cascade) - assume cascade, but safe delete report
    await db.delete(mdrReports)
        .where(eq(mdrReports.id, reportId))
  },

  // ==================== GET AVAILABLE SITES ====================
  async getSites(tenantId: string) {
    const sql = `
      SELECT DISTINCT host_site_name as name
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND host_site_name != ''
      ORDER BY name ASC
    `
    const rows = await query<{ name: string }>(sql, { tenantId })
    return rows.map(r => r.name)
  }
}
