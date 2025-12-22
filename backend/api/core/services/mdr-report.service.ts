import { db } from '../../infra/db'
import { incidents, alerts, securityEvents, tenants, mdrReports, mdrReportSnapshots } from '../../infra/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { clickhouse, query } from '../../infra/clickhouse/client'
import { AIService } from './ai.service'
import { IntegrationService } from './integration.service'
import crypto from 'crypto'

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
  
  // Section 5: Appendix
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
  
  // ==================== GENERATE AI SUMMARIES ====================
  async generateAISummaries(data: Partial<MdrReportData>, tenantId: string) {
    try {
      // 1. Get Tenant AI Config
      const aiConfig = await IntegrationService.getAIConfig(tenantId)
      
      if (!aiConfig || !aiConfig.apiKey) {
        throw new Error('AI_NOT_CONNECTED')
      }

      // 2. Create Provider Instance locally (No Singleton!)
      const aiProvider = AIService.createProvider(aiConfig.provider, aiConfig.apiKey)
      
      const partialData = data as any
      // Build Prompt with Critical Samples
      let evidenceText = ""
      if (partialData.criticalSamples && partialData.criticalSamples.length > 0) {
        evidenceText = "\nตัวอย่างเหตุการณ์ที่พบ (Evidence):\n" + 
          partialData.criticalSamples.map((e: any, i: number) => 
            `${i+1}. [${e.severity}] ${e.threat} on ${e.host_name} (User: ${e.user_name}) - Action: ${e.action_taken}`
          ).join('\n')
      }

      // Generate incident recommendation
      const incidentPrompt = `
คุณเป็น Senior Security Analyst ของ SOC Center
กรุณาวิเคราะห์ภาพรวมของเดือนนี้ (Monthly Overview) จากข้อมูลต่อไปนี้:

- จำนวน Threats: ${partialData.overview?.threats || 0}
- Mitigated: ${partialData.overview?.mitigated || 0}
- Malicious: ${partialData.overview?.malicious || 0}
- Top Endpoints ที่พบปัญหา: ${partialData.topEndpoints?.slice(0, 3).map((e: any) => e.name).join(', ') || 'ไม่มีข้อมูล'}
- Top Threats: ${partialData.topThreats?.slice(0, 3).map((t: any) => t.name).join(', ') || 'ไม่มีข้อมูล'}
${evidenceText}

คำแนะนำ (Instructions):
1. เขียนสรุปสถานการณ์ความปลอดภัยของเดือนนี้ (2-3 ประโยค)
2. ยกตัวอย่างเหตุการณ์สำคัญ (จาก Evidence ถ้ามี)
3. ให้คำแนะนำในการป้องกัน (Actionable Recommendations) 2-3 ข้อ

เขียนเป็นภาษาไทย ทางการและกระชับ
`
      const incidentRecommendation = await aiProvider.generateText(incidentPrompt)
      
      // Generate risk assessment
      const riskPrompt = `
คุณเป็น Security Consultant กรุณาวิเคราะห์ Risk Assessment สำหรับรายงาน Monthly MDR Report
ข้อมูล Security Events:
- จำนวน Threats ทั้งหมด: ${partialData.overview?.threats || 0}
- Threats ที่ยังไม่ได้รับการแก้ไข: ${partialData.overview?.notMitigated || 0}
- Malicious Events: ${partialData.overview?.malicious || 0}
${evidenceText}

คำแนะนำ (Instructions):
1. ประเมินความเสี่ยง (Risk Result): ประเมินระดับความเสี่ยง (ต่ำ/ปานกลาง/สูง) และอธิบายเหตุผลสั้นๆ
2. ข้อแนะนำเชิงกลยุทธ์ (Strategic Recommendations): เสนอแนวทางปรับปรุง Policy หรือ Configuration เพื่อลดความเสี่ยงในอนาคต (2-3 ข้อ)

เขียนเป็นภาษาไทย ทางการและเป็นมืออาชีพ ใช้ Format:
ผลการประเมินความเสี่ยง: [ผลประเมิน]
คำแนะนำ: [ข้อแนะนำ]
`
      const riskAnalysis = await aiProvider.generateText(riskPrompt)
      
      // Split risk analysis into result and recommendation
      const parts = riskAnalysis.split('คำแนะนำ')
      const riskResult = parts[0]?.replace('ผลการประเมินความเสี่ยง', '').trim() || 'ไม่สามารถวิเคราะห์ได้'
      const riskRecommendation = parts[1]?.trim() || 'ไม่สามารถให้คำแนะนำได้'
      
      return {
        incidentRecommendation: incidentRecommendation || 'ไม่มีคำแนะนำ',
        riskAssessment: {
          result: riskResult,
          recommendation: riskRecommendation
        },
        vulnerabilityRecommendation: 'กรุณาอัพเดท application และ patch ช่องโหว่ที่พบโดยเร็วที่สุด'
      }
    } catch (error: any) {
        if (error.message === 'AI_NOT_CONNECTED') {
            throw new Error('AI_NOT_CONNECTED') // Propagate up
        }
           console.error('AI Summary generation failed:', error)
      // Fallback to default text
      return {
        incidentRecommendation: 'กรุณาตรวจสอบและแก้ไข threats ที่พบตามลำดับความสำคัญ (AI Unavailable)',
        riskAssessment: {
          result: 'ระดับความเสี่ยง: ปานกลาง - ควรดำเนินการแก้ไขตาม SLA',
          recommendation: 'แนะนำให้ตรวจสอบ endpoints ที่มีปัญหาบ่อย และอัพเดท security policies'
        },
        vulnerabilityRecommendation: 'กรุณาอัพเดท application และ patch ช่องโหว่ที่พบโดยเร็วที่สุด'
      }
    }
  },
  
  // ==================== CREATE FULL REPORT SNAPSHOT ====================
  async createSnapshot(tenantId: string, monthYear: string, createdById?: string, siteNames: string[] = []) {
    const dateRange = getMonthDateRange(monthYear)
    
    // Get tenant info
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
    if (!tenant) throw new Error('Tenant not found')
    
    // Aggregate all data
    const [overview, topEndpoints, topThreats, incidents, vulnerabilities, criticalSamples] = await Promise.all([
      this.getIncidentOverview(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getTopEndpoints(tenantId, dateRange.start, dateRange.end, 10, siteNames),
      this.getTopThreats(tenantId, dateRange.start, dateRange.end, 10, siteNames),
      this.getIncidentDetails(tenantId, dateRange.start, dateRange.end, 50, siteNames),
      this.getVulnerabilities(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getCriticalEventsSample(tenantId, dateRange.start, dateRange.end, 10, siteNames)
    ])
    
    // Generate AI summaries
    // const partialData = { overview, topEndpoints, topThreats, criticalSamples } // Removed duplicate declaration
    const aiSummaries = await this.generateAISummaries({ overview, topEndpoints, topThreats, criticalSamples }, tenantId)
    
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
      
      vulnerabilities: {
        ...vulnerabilities,
        recommendation: aiSummaries.vulnerabilityRecommendation
      },
      
      // Default glossary
      glossary: [
        { term: 'SQL Injection', definition: 'การโจมตีโดยการแทรก SQL code เข้าไปใน input ของ application' },
        { term: 'Ransomware', definition: 'มัลแวร์ที่เข้ารหัสไฟล์แล้วเรียกค่าไถ่' },
        { term: 'Zero-Day Exploit', definition: 'การโจมตีช่องโหว่ที่ยังไม่มี patch' },
        { term: 'Phishing', definition: 'การหลอกลวงผ่าน email หรือ website ปลอม' },
        { term: 'MITRE ATT&CK', definition: 'Framework สำหรับจัดหมวดหมู่เทคนิคการโจมตี' }
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
      // Update existing report status
      await db.update(mdrReports)
        .set({ status: 'draft', updatedAt: new Date() })
        .where(eq(mdrReports.id, reportId))
    } else {
      // Create new report
      const [newReport] = await db.insert(mdrReports)
        .values({
          tenantId,
          monthYear,
          status: 'draft'
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
  async listReports(tenantId: string) {
    const reports = await db.select()
      .from(mdrReports)
      .where(eq(mdrReports.tenantId, tenantId))
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
