import { query } from '../../infra/clickhouse/client'
import { db } from '../../infra/db'
import { tenants, users, mdrReports, mdrReportSnapshots } from '../../infra/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { AIService } from './ai.service'
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
  async getIncidentOverview(tenantId: string, startDate: string, endDate: string) {
    const sql = `
      SELECT 
        countIf(severity IN ('critical', 'high')) as threats,
        countIf(JSONExtractString(raw_data, 'threatInfo.mitigationStatus') = 'mitigated') as mitigated,
        countIf(JSONExtractString(raw_data, 'threatInfo.analystVerdict') = 'true_positive') as malicious,
        countIf(JSONExtractString(raw_data, 'threatInfo.analystVerdict') = 'suspicious') as suspicious,
        countIf(JSONExtractString(raw_data, 'threatInfo.analystVerdict') = 'false_positive') as benign,
        countIf(JSONExtractString(raw_data, 'threatInfo.mitigationStatus') != 'mitigated' AND severity IN ('critical', 'high')) as not_mitigated
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
    `
    const rows = await query<{
      threats: string
      mitigated: string
      malicious: string
      suspicious: string
      benign: string
      not_mitigated: string
    }>(sql, { tenantId, startDate, endDate })
    
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
  async getTopEndpoints(tenantId: string, startDate: string, endDate: string, limit: number = 10) {
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
      GROUP BY host_name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    const rows = await query<{ name: string; count: string }>(sql, { tenantId, startDate, endDate, limit })
    return rows.map(r => ({ name: r.name, count: parseInt(r.count) }))
  },
  
  // ==================== GET TOP THREATS ====================
  async getTopThreats(tenantId: string, startDate: string, endDate: string, limit: number = 10) {
    const sql = `
      SELECT 
        coalesce(
          nullIf(JSONExtractString(raw_data, 'ThreatName'), ''),
          nullIf(JSONExtractString(raw_data, 'threatInfo.threatName'), ''),
          nullIf(file_name, ''),
          nullIf(process_name, ''),
          'Unknown Threat'
        ) as name,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND severity IN ('critical', 'high', 'medium')
      GROUP BY name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    const rows = await query<{ name: string; count: string }>(sql, { tenantId, startDate, endDate, limit })
    return rows.map(r => ({ name: r.name, count: parseInt(r.count) }))
  },
  
  // ==================== GET INCIDENT DETAILS ====================
  async getIncidentDetails(tenantId: string, startDate: string, endDate: string, limit: number = 50) {
    const sql = `
      SELECT 
        CASE 
          WHEN JSONExtractString(raw_data, 'threatInfo.mitigationStatus') = 'mitigated' THEN 'mitigated'
          WHEN severity IN ('critical', 'high') THEN 'pending'
          ELSE 'resolved'
        END as status,
        coalesce(
          nullIf(JSONExtractString(raw_data, 'ThreatName'), ''),
          nullIf(JSONExtractString(raw_data, 'threatInfo.threatName'), ''),
          nullIf(file_name, ''),
          'Unknown Threat'
        ) as threat_details,
        coalesce(nullIf(JSONExtractString(raw_data, 'threatInfo.confidenceLevel'), ''), severity) as confidence_level,
        host_name as endpoint,
        coalesce(nullIf(JSONExtractString(raw_data, 'threatInfo.classification'), ''), event_type) as classification,
        coalesce(nullIf(file_hash_sha256, ''), nullIf(file_hash_sha1, ''), nullIf(file_hash_md5, ''), 'N/A') as hash,
        coalesce(nullIf(file_path, ''), 'N/A') as path
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND severity IN ('critical', 'high', 'medium')
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
    }>(sql, { tenantId, startDate, endDate, limit })
    
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
  
  // ==================== GET VULNERABILITIES ====================
  // Note: This would typically come from a vulnerability scanner integration
  // For now, we'll mock this or extract from raw_data if available
  async getVulnerabilities(tenantId: string, startDate: string, endDate: string) {
    // Try to get vulnerability data from security_events if available
    const sql = `
      SELECT 
        coalesce(nullIf(JSONExtractString(raw_data, 'applicationName'), ''), 'Unknown App') as application,
        count() as cve_count,
        any(JSONExtractString(raw_data, 'cve')) as top_cve,
        max(severity) as highest_severity,
        any(JSONExtractString(raw_data, 'description')) as description
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND event_type = 'vulnerability'
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
      }>(sql, { tenantId, startDate, endDate })
      
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
      // Return empty if vulnerability data not available
      return {
        appsByVulnerabilities: [],
        endpointsByVulnerabilities: [],
        recommendation: 'No vulnerability data available for this period.'
      }
    }
  },
  
  // ==================== GENERATE AI SUMMARIES ====================
  async generateAISummaries(data: Partial<MdrReportData>) {
    try {
      // Initialize AI Service if needed
      // @ts-ignore - accessing private property for text generation
      if (!AIService['provider']) AIService.initialize()
      
      // Generate incident recommendation
      const incidentPrompt = `
คุณเป็น Security Analyst ผู้เชี่ยวชาญ กรุณาสร้างคำแนะนำ (Recommendation) สำหรับรายงาน MDR รายเดือน
โดยอิงจากข้อมูลต่อไปนี้:
- จำนวน Threats: ${data.overview?.threats || 0}
- Mitigated: ${data.overview?.mitigated || 0}
- Malicious: ${data.overview?.malicious || 0}
- Top Endpoints ที่พบปัญหา: ${data.topEndpoints?.slice(0, 3).map(e => e.name).join(', ') || 'ไม่มีข้อมูล'}
- Top Threats: ${data.topThreats?.slice(0, 3).map(t => t.name).join(', ') || 'ไม่มีข้อมูล'}

กรุณาเขียนคำแนะนำเป็นภาษาไทยแบบมืออาชีพ ความยาว 2-3 ย่อหน้า เน้นการปฏิบัติจริง
`
      // @ts-ignore - accessing provider directly
      const incidentRecommendation = await AIService['provider'].generateText(incidentPrompt)
      
      // Generate risk assessment
      const riskPrompt = `
คุณเป็น Security Consultant กรุณาวิเคราะห์ Risk Assessment สำหรับองค์กร
โดยอิงจากข้อมูล Security Events ดังนี้:
- จำนวน Threats ทั้งหมด: ${data.overview?.threats || 0}
- Threats ที่ยังไม่ได้รับการแก้ไข: ${data.overview?.notMitigated || 0}
- Malicious Events: ${data.overview?.malicious || 0}

กรุณาเขียน:
1. ผลการประเมินความเสี่ยง (Result) - 1 ย่อหน้า
2. คำแนะนำเชิงกลยุทธ์ (Recommendation) - 2-3 ย่อหน้า

เขียนเป็นภาษาไทยแบบมืออาชีพ
`
      // @ts-ignore - accessing provider directly
      const riskAnalysis = await AIService['provider'].generateText(riskPrompt)
      
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
    } catch (error) {
      console.error('AI Summary generation failed:', error)
      // Fallback to default text
      return {
        incidentRecommendation: 'กรุณาตรวจสอบและแก้ไข threats ที่พบตามลำดับความสำคัญ',
        riskAssessment: {
          result: 'ระดับความเสี่ยง: ปานกลาง - ควรดำเนินการแก้ไขตาม SLA',
          recommendation: 'แนะนำให้ตรวจสอบ endpoints ที่มีปัญหาบ่อย และอัพเดท security policies'
        },
        vulnerabilityRecommendation: 'กรุณาอัพเดท application และ patch ช่องโหว่ที่พบโดยเร็วที่สุด'
      }
    }
  },
  
  // ==================== CREATE FULL REPORT SNAPSHOT ====================
  async createSnapshot(tenantId: string, monthYear: string, createdById?: string) {
    const dateRange = getMonthDateRange(monthYear)
    
    // Get tenant info
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
    if (!tenant) throw new Error('Tenant not found')
    
    // Aggregate all data
    const [overview, topEndpoints, topThreats, incidents, vulnerabilities] = await Promise.all([
      this.getIncidentOverview(tenantId, dateRange.start, dateRange.end),
      this.getTopEndpoints(tenantId, dateRange.start, dateRange.end),
      this.getTopThreats(tenantId, dateRange.start, dateRange.end),
      this.getIncidentDetails(tenantId, dateRange.start, dateRange.end),
      this.getVulnerabilities(tenantId, dateRange.start, dateRange.end)
    ])
    
    // Generate AI summaries
    const partialData = { overview, topEndpoints, topThreats }
    const aiSummaries = await this.generateAISummaries(partialData)
    
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
  }
}
