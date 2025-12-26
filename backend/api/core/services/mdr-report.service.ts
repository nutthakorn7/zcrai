import { db } from '../../infra/db'
import { tenants, mdrReports, mdrReportSnapshots } from '../../infra/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { clickhouse, query } from '../../infra/clickhouse/client'
import { AIService } from './ai.service'
import { IntegrationService } from './integration.service'
import crypto from 'crypto'
import dayjs from 'dayjs'

// Threat Classification Categories
export interface ThreatClassification {
  Malware: number
  Ransomware: number
  Cryptominer: number
  Packed: number
  General: number
  Exploit: number
}

// Helper: Map threat name to category based on keywords
const classifyThreat = (threatName: string): keyof ThreatClassification => {
  const name = threatName.toLowerCase()
  
  if (name.includes('ransom') || name.includes('crypt') || name.includes('lock') || name.includes('wannacry')) return 'Ransomware'
  if (name.includes('miner') || name.includes('coin') || name.includes('xmrig') || name.includes('crypto')) return 'Cryptominer'
  if (name.includes('pack') || name.includes('compress') || name.includes('obfus') || name.includes('upx')) return 'Packed'
  if (name.includes('exploit') || name.includes('cve-') || name.includes('shell') || name.includes('overflow')) return 'Exploit'
  if (name.includes('pua') || name.includes('adware') || name.includes('toolbar') || name.includes('bundler') || name.includes('generic')) return 'General'
  
  // Default fallback for Trojan, Virus, Backdoor, Worm, etc.
  return 'Malware'
}

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
    classification: ThreatClassification  // 🔥 New: Threat category breakdown
  }
  
  // Section 1.1: Top Endpoints & Threats
  topEndpoints: Array<{ name: string; count: number }>
  topThreats: Array<{ name: string; count: number }>
  classifications: Array<{ name: string; count: number }>
  
  // Section 2: Incident Details
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
  
  // Section 2.2: Recommendation (AI Generated)
  incidentRecommendation: string
  
  // Section 3: Risk Assessment
  riskAssessment: {
    result: string            // AI Generated risk profile
    recommendation: string    // AI Generated strategic advice
    riskyFiles: Array<{
      endpoint: string
      ipAddress: string
      path: string
    }>
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
  
  // ==================== GET CLASSIFICATION STATS (PIE CHART) ====================
  // Query threat_name and classify into categories: Malware, Ransomware, Cryptominer, Packed, General, Exploit
  async getClassificationStats(tenantId: string, startDate: string, endDate: string, siteNames: string[] = []): Promise<ThreatClassification> {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''
    
    // Query threat names from security_events
    const sql = `
      SELECT 
        coalesce(nullIf(threat_name, ''), nullIf(title, ''), 'Unknown') as threat_name,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND severity IN ('critical', 'high')
        ${siteFilter}
      GROUP BY threat_name
      ORDER BY count DESC
    `
    const rows = await query<{ threat_name: string; count: string }>(sql, { tenantId, startDate, endDate, siteNames })
    console.log('📊 getClassificationStats raw threats:', rows.length, 'items')
    
    // Initialize classification stats
    const classificationStats: ThreatClassification = {
      Malware: 0,
      Ransomware: 0,
      Cryptominer: 0,
      Packed: 0,
      General: 0,
      Exploit: 0
    }
    
    // Classify each threat
    rows.forEach(item => {
      const category = classifyThreat(item.threat_name)
      classificationStats[category] += parseInt(item.count) || 0
    })
    
    console.log('📊 getClassificationStats result:', classificationStats)
    return classificationStats
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
  
  // ==================== GET INCIDENT DETAILS (SAFE VERSION) ====================
  async getIncidentDetails(tenantId: string, startDate: string, endDate: string, limit: number = 50, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''

    const sql = `
      SELECT 
        -- 1. Status Information (เท่าที่มี)
        threat_mitigated,
        analyst_verdict,
        
        -- 2. Threat Name (ลำดับความสำคัญ: Threat Name -> File -> Process -> Description -> Event Type)
        coalesce(
          nullIf(threat_name, ''), 
          nullIf(file_name, ''), 
          nullIf(process_name, ''),
          nullIf(description, ''), 
          nullIf(title, ''), 
          concat(event_type, ' detected')
        ) as threat_name,

        -- 3. Severity & Host
        severity,
        coalesce(nullIf(host_name, ''), 'Unknown Host') as host_name,

        -- 4. Hash (ใช้คอลัมน์มาตรฐานเท่านั้น)
        coalesce(
          nullIf(file_sha256, ''), 
          nullIf(file_hash, ''), 
          nullIf(file_md5, ''), 
          '-'
        ) as file_hash,

        -- 5. Path
        coalesce(
          nullIf(file_path, ''), 
          nullIf(process_path, ''), 
          '-'
        ) as file_path,

        coalesce(nullIf(host_ip, ''), nullIf(host_external_ip, ''), '-') as host_ip,
        
        -- 6. Confidence
        confidence_level
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND severity IN ('critical', 'high', 'medium')
        ${siteFilter}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}
    `
    
    const rows = await query<any>(sql, { tenantId, startDate, endDate, limit, siteNames })

    return rows.map(r => {
      let status: 'mitigated' | 'not_mitigated' | 'benign' | 'pending' = 'pending'
      
      const verdict = (r.analyst_verdict || '').toLowerCase()
      
      // 1. Check Benign
      if (verdict.includes('benign') || verdict.includes('false')) {
        status = 'benign'
      } 
      // 2. Check Mitigated
      else if (
        r.threat_mitigated === true || 
        r.threat_mitigated === 1 || 
        verdict.includes('mitigated') ||
        verdict.includes('resolved')
      ) {
        status = 'mitigated'
      } 
      // 3. Check Not Mitigated
      else if (verdict.includes('true') || verdict.includes('malicious')) {
        status = 'not_mitigated'
      }
      
      return {
        status,
        threatDetails: r.threat_name,
        confidenceLevel: r.confidence_level || r.severity || 'High',
        endpoint: r.host_name,
        classification: classifyThreat(r.threat_name), 
        hash: r.file_hash,
        path: r.file_path,
        ipAddress: r.host_ip
      }
    })
  },

  // ==================== GET RISKY FILES (SENSITIVE DATA) ====================
  async getRiskyFiles(tenantId: string, startDate: string, endDate: string, limit: number = 15, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''
    
    // Find events where file path contains sensitive keywords
    const sql = `
      SELECT DISTINCT
        coalesce(nullIf(host_name, ''), 'Unknown') as endpoint,
        coalesce(nullIf(host_ip, ''), nullIf(host_external_ip, ''), '-') as ip_address,
        coalesce(nullIf(file_path, ''), nullIf(process_path, ''), '') as path
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND (
          lower(file_path) LIKE '%password%' OR
          lower(file_path) LIKE '%passport%' OR
          lower(file_path) LIKE '%credential%' OR
          lower(file_path) LIKE '%secret%' OR
          lower(file_path) LIKE '%confidential%' OR
          lower(file_path) LIKE '%private%' OR
          lower(file_path) LIKE '%key%' OR
          lower(file_path) LIKE '%.pem' OR
          lower(file_path) LIKE '%.key' OR
          lower(file_path) LIKE '%.pfx'
        )
        ${siteFilter}
      LIMIT {limit:UInt32}
    `
    
    const rows = await query<{ endpoint: string; ip_address: string; path: string }>(sql, { tenantId, startDate, endDate, limit, siteNames })
    
    return rows.map(r => ({
      endpoint: r.endpoint,
      ipAddress: r.ip_address,
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

  // ==================== GET VULNERABILITIES (RAW DATA VERSION) ====================
  async getVulnerabilities(tenantId: string, startDate: string, endDate: string, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''
    
    // 🔍 Query 1: Applications (ดึงชื่อดิบๆ มาเลย เดี๋ยวให้ AI จัดการ)
    const sql = `
      SELECT 
        coalesce(
          nullIf(process_name, ''), 
          nullIf(file_name, ''), 
          nullIf(threat_name, ''),
          'Unknown Application'
        ) as application,
        
        count() as cve_count,
        any(threat_name) as top_cve, 
        max(severity) as highest_severity,
        concat('Security events detected associated with ', application) as description
        
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        AND severity IN ('critical', 'high') 
        ${siteFilter}
      GROUP BY application
      ORDER BY cve_count DESC
      LIMIT 15
    `
    
    // 🔍 Query 2: Endpoints (ดึงชื่อดิบเหมือนกัน)
    const endpointSql = `
        SELECT 
            coalesce(
              nullIf(process_name, ''), 
              nullIf(file_name, ''), 
              nullIf(threat_name, ''),
              'Unknown Application'
            ) as application,
            max(severity) as highest_severity,
            uniq(host_name) as endpoint_count,
            arrayStringConcat(arraySlice(groupUniqArray(host_name), 1, 3), ', ') as top_endpoints
        FROM security_events
        WHERE tenant_id = {tenantId:String}
            AND toDate(timestamp) >= {startDate:String}
            AND toDate(timestamp) <= {endDate:String}
            AND severity IN ('critical', 'high')
            ${siteFilter}
        GROUP BY application
        ORDER BY endpoint_count DESC
        LIMIT 15
    `
    
    try {
      const [appsData, endpointsData] = await Promise.all([
          query<any>(sql, { tenantId, startDate, endDate, siteNames }),
          query<any>(endpointSql, { tenantId, startDate, endDate, siteNames })
      ])
      
      return {
        appsByVulnerabilities: appsData.map((r: any) => ({
          application: r.application, // ส่งชื่อดิบออกไป (เช่น winword.exe)
          cveCount: parseInt(r.cve_count),
          topCve: r.top_cve, 
          highestSeverity: r.highest_severity || 'High',
          description: r.description
        })),
        endpointsByVulnerabilities: endpointsData.map((r: any) => ({
          application: r.application,
          highestSeverity: r.highest_severity || 'High',
          endpointCount: parseInt(r.endpoint_count),
          topEndpoints: r.top_endpoints
        })),
        recommendation: '' // AI จะเขียนทับทีหลัง
      }
    } catch (e) {
      console.error('Vulnerability query failed:', e)
      return {
        appsByVulnerabilities: [],
        endpointsByVulnerabilities: [],
        recommendation: ''
      }
    }
  },

  // ==================== AI HELPER: NORMALIZE APP NAMES (HYBRID VERSION) ====================
  async normalizeAppNamesWithAI(rawApps: string[], tenantId: string): Promise<Record<string, string>> {
    if (!rawApps || rawApps.length === 0) return {}

    // 1. Clean & Unique List
    const uniqueApps = [...new Set(rawApps)].filter(a => a && a !== 'Unknown Application')
    if (uniqueApps.length === 0) return {}

    // 🛡️ MANUAL OVERRIDE MAP (ของที่เจอบ่อยๆ )
    const manualMap: Record<string, string> = {
        'tvnserver.exe': 'TightVNC Server (Remote Access)',
        'Utilman.exe': 'Windows Utility Manager (System)',
        'setup.exe': 'Application Installer / Generic Setup',
        'Adjprog.exe': 'Epson Adjustment Program (Riskware)',
        'TunMirror.exe': 'Tunnel Mirroring Tool',
        'TunMirror2.exe': 'Tunnel Mirroring Tool v2',
        'OInstall.exe': 'Office KMS Activator (Pirated Software)',
        'OInstallLite.exe': 'Office KMS Activator Lite',
        'SppExtComObjHook.dll': 'KMS Licensing Hook (Pirated)',
        'DriverPackNotifier.exe': 'DriverPack Solution (Adware)',
        'UC232A_Windows_Setup_V1.0.082.exe': 'USB-Serial Driver Installer',
        'tbMyAs.dll': 'Browser Toolbar Adware',
        'ReSample.exe': 'Resample Tool',
        'TXAE.exe': 'Trojan/Riskware Executable',
        'winword.exe': 'Microsoft Word',
        'excel.exe': 'Microsoft Excel',
        'powerpnt.exe': 'Microsoft PowerPoint',
        'outlook.exe': 'Microsoft Outlook',
        'chrome.exe': 'Google Chrome',
        'firefox.exe': 'Mozilla Firefox',
        'msedge.exe': 'Microsoft Edge',
        'notepad.exe': 'Windows Notepad',
        'cmd.exe': 'Windows Command Prompt',
        'powershell.exe': 'Windows PowerShell',
        'explorer.exe': 'Windows Explorer',
        'svchost.exe': 'Windows Service Host',
        'autorun.exe': 'AutoRun Malware'
    }

    // แยกแยะว่าตัวไหนมีใน Manual Map แล้ว ตัวไหนยังไม่มี (ต้องถาม AI)
    const knownApps: Record<string, string> = {}
    const unknownApps: string[] = []

    uniqueApps.forEach(app => {
        // เช็คแบบ Case Insensitive
        const key = Object.keys(manualMap).find(k => k.toLowerCase() === app.toLowerCase())
        if (key) {
            knownApps[app] = manualMap[key]
        } else {
            unknownApps.push(app)
        }
    })

    // ถ้าไม่มีตัวที่ต้องถาม AI แล้ว ก็จบงานเลย
    if (unknownApps.length === 0) {
        return knownApps
    }

    console.log(`🤖 AI Normalizing ${unknownApps.length} apps... (Found ${Object.keys(knownApps).length} in manual map)`)

    // 2. Ask AI for the rest
    const prompt = `You are an IT Asset Management Expert.
Map the following Process/File names to their official "Product Name" or "Application Name".

Input List:
${JSON.stringify(unknownApps)}

Rules:
1. Remove .exe, .dll extensions.
2. Identify known malware/hacktools (e.g. "OInstall.exe" -> "Office Activator").
3. Use official branding (e.g. "winword.exe" -> "Microsoft Word").
4. Return ONLY valid JSON: { "filename.exe": "Pretty Name" }`

    try {
      const aiConfig = await IntegrationService.getAIConfig(tenantId)
      if (!aiConfig || !aiConfig.apiKey) return knownApps // Fallback to manual map only
      
      const aiProvider = AIService.createProvider(aiConfig.provider, aiConfig.apiKey)
      const jsonStr = await aiProvider.generateText(prompt)
      
      // 🛡️ Robust JSON Extraction (หาปีกกาเปิด-ปิด ป้องกัน Text ขยะ)
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      
      if (firstBrace !== -1 && lastBrace !== -1) {
          const cleanJson = jsonStr.substring(firstBrace, lastBrace + 1)
          const aiMapping = JSON.parse(cleanJson)
          
          // รวมผลลัพธ์ (Manual + AI)
          return { ...knownApps, ...aiMapping }
      } else {
          console.warn('❌ AI did not return valid JSON, using manual map only.')
          return knownApps
      }

    } catch (e) {
      console.error('❌ AI Normalization failed:', e)
      return knownApps // อย่างน้อยก็ได้ตัวที่ Manual Map ไว้
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
    
    // ==================== VULNERABILITY RECOMMENDATION (AI Generated) ====================
    const vulnData = partialData.vulnerabilities?.appsByVulnerabilities || []
    const topApps = vulnData.slice(0, 5).map((v: any) => v.application).join(', ')

    let vulnRecommendation = 'No high-risk applications detected. Continue regular security monitoring and patch management.'
    
    if (topApps) {
      const vulnPrompt = `You are a Vulnerability Management Specialist.
    
Analyze the following detected application anomalies:
Top Affected Applications: ${topApps}

**Instructions:**
Write a professional "Vulnerability Recommendation" section (approx 150-200 words).
1. Summarize the risks associated with these applications (mention them by name).
2. Explain potential security implications (RCE, Privilege Escalation, Data Theft).
3. Provide 4-5 bullet points of STRONG recommendations (e.g., "Prioritize upgrading...", "Apply security patches...", "Remove unused components...").

**Requirements:**
- Write in professional English
- Be specific and reference actual applications from the data
- Focus on actionable steps
- Keep it concise (maximum 200 words)

Return plain text only, no JSON.`

      try {
        vulnRecommendation = await aiProvider.generateText(vulnPrompt)
      } catch (e) {
        console.error('Vulnerability recommendation generation failed:', e)
        vulnRecommendation = 'High-risk applications detected. Investigate and restrict usage immediately.'
      }
    }
    
    return {
      incidentRecommendation: incidentRecommendation.trim(),
      riskAssessment: {
        result: riskLevel,
        recommendation: recommendationsText
      },
      vulnerabilityRecommendation: vulnRecommendation.trim()
    }
  },
  
  // ==================== GET TOP CLASSIFICATIONS (PIE CHART) ====================
  // Uses 'classification' column which contains: Malware, General, Ransomware, Packed, Cryptominer, etc.
  async getTopClassifications(tenantId: string, startDate: string, endDate: string, limit: number = 5, siteNames: string[] = []) {
    const siteFilter = siteNames.length > 0 ? 'AND host_site_name IN {siteNames:Array(String)}' : ''

    // Try classification first, fallback to event_type if classification is empty
    const sql = `
      SELECT 
        coalesce(
          nullIf(classification, ''),
          nullIf(event_type, ''),
          'Unknown'
        ) as name,
        count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND toDate(timestamp) >= {startDate:String}
        AND toDate(timestamp) <= {endDate:String}
        ${siteFilter}
      GROUP BY name
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `
    const rows = await query<{ name: string; count: string }>(sql, { tenantId, startDate, endDate, limit, siteNames })
    console.log('📊 getTopClassifications result:', rows)
    return rows.map(r => ({ name: r.name, count: parseInt(r.count) }))
  },

  // ==================== GENERATE REPORT DATA ====================
  // Method to generate complete report data with all 7 sections using REAL DATA ONLY
  async generateReportData(tenantId: string, monthYear: string): Promise<MdrReportData> {
    const dateRange = getMonthDateRange(monthYear)
    const startDate = dateRange.start
    const endDate = dateRange.end

    console.log(`🧠 Generating Real Intelligence for ${tenantId} [${startDate} to ${endDate}]`)

    // Get tenant info
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
    if (!tenant) throw new Error('Tenant not found')

    // Fetch ALL data from ClickHouse using existing helper methods (REAL DATA)
    const [overview, classificationStats, topEndpoints, topThreats, incidents, classifications, vulnerabilitiesRaw, criticalSamples, dataLeaks, networkActivity, riskyFiles] = await Promise.all([
      this.getIncidentOverview(tenantId, startDate, endDate),
      this.getClassificationStats(tenantId, startDate, endDate),
      this.getTopEndpoints(tenantId, startDate, endDate, 10),
      this.getTopThreats(tenantId, startDate, endDate, 10),
      this.getIncidentDetails(tenantId, startDate, endDate, 50),
      this.getTopClassifications(tenantId, startDate, endDate, 5),
      this.getVulnerabilities(tenantId, startDate, endDate), // 👈 ข้อมูลดิบ (Raw Names)
      this.getCriticalEventsSample(tenantId, startDate, endDate, 10),
      this.getDataLeaks(tenantId, startDate, endDate),
      this.getNetworkActivity(tenantId, startDate, endDate),
      this.getRiskyFiles(tenantId, startDate, endDate)
    ])

    // 🔥 AI ENRICHMENT STEP: Normalize app names with AI
    const rawAppNames = [
        ...vulnerabilitiesRaw.appsByVulnerabilities.map((v: any) => v.application),
        ...vulnerabilitiesRaw.endpointsByVulnerabilities.map((v: any) => v.application)
    ]
    
    // ส่งไปให้ AI แปลงร่าง
    const appNameMapping = await this.normalizeAppNamesWithAI(rawAppNames, tenantId)
    
    // 🔥 APPLY MAPPING: เอาชื่อใหม่มาใส่แทนชื่อเก่า
    const vulnerabilities = {
        ...vulnerabilitiesRaw,
        appsByVulnerabilities: vulnerabilitiesRaw.appsByVulnerabilities.map((v: any) => {
            const prettyName = appNameMapping[v.application] || v.application
            return {
                ...v,
                application: prettyName,
                description: `Security events detected associated with ${prettyName}`
            }
        }),
        endpointsByVulnerabilities: vulnerabilitiesRaw.endpointsByVulnerabilities.map((v: any) => ({
            ...v,
            application: appNameMapping[v.application] || v.application
        }))
    }

    // Generate AI summaries using tenant's configured AI provider (REAL AI)
    // ส่งข้อมูลที่แก้ชื่อแล้วไปให้ AI สรุป
    const aiSummaries = await this.generateAISummaries(
      { overview, topEndpoints, topThreats, criticalSamples, vulnerabilities } as any, 
      tenantId
    )

    // Construct Final JSON with REAL DATA ONLY
    return {
      tenantId,
      tenantName: tenant.name,
      monthYear,
      dateRange,
      generatedAt: new Date().toISOString(),
      
      // Section 1: Overview (Real ClickHouse Data + Classification Stats)
      overview: {
        ...overview,
        classification: classificationStats  // 🔥 Threat category breakdown
      },
      topEndpoints,
      topThreats,
      classifications, // New Field

      // Section 2: Incidents (Real ClickHouse Data + Real AI)
      incidents,
      incidentRecommendation: aiSummaries.incidentRecommendation,

      // Section 3: Risk Assessment (Real AI + Risky Files)
      riskAssessment: {
        ...aiSummaries.riskAssessment,
        riskyFiles
      },

      // Section 4: Vulnerability (Real ClickHouse Data + Real AI)
      vulnerabilities: {
        ...vulnerabilities,
        recommendation: aiSummaries.vulnerabilityRecommendation
      },

      // Section 5: Data Leak (Real ClickHouse Data - empty if no data)
      dataLeaks,

      // Section 6: Network Activity (Real ClickHouse Data - empty if no data)
      networkActivity,

      // Section 7: Appendix - Default glossary
      glossary: [
        { term: 'SQL Injection', definition: 'A code injection attack where malicious SQL statements are inserted into application input fields to manipulate or access the database.' },
        { term: 'Ransomware', definition: 'Malicious software that encrypts victim files and demands payment (ransom) for the decryption key.' },
        { term: 'Zero-Day Exploit', definition: 'An attack that exploits a previously unknown vulnerability for which no patch or fix is available.' },
        { term: 'Phishing', definition: 'A social engineering attack using fraudulent emails or websites to trick users into revealing sensitive information.' },
        { term: 'MITRE ATT&CK', definition: 'A globally-accessible knowledge base of adversary tactics and techniques based on real-world observations.' },
        { term: 'APT (Advanced Persistent Threat)', definition: 'A prolonged and targeted cyberattack in which an intruder gains access to a network and remains undetected for an extended period.' },
        { term: 'CVE (Common Vulnerabilities and Exposures)', definition: 'A standardized identifier for known security vulnerabilities in software and hardware products.' },
        { term: 'EDR (Endpoint Detection and Response)', definition: 'A cybersecurity technology that continuously monitors end-user devices to detect and respond to cyber threats.' },
        { term: 'IOC (Indicator of Compromise)', definition: 'Forensic evidence of potential intrusions on a host system or network, such as file hashes, IP addresses, or domain names.' },
        { term: 'MDR (Managed Detection and Response)', definition: 'A cybersecurity service that combines advanced technology with human expertise to hunt, detect, and respond to threats.' }
      ]
    }
  },

  // ==================== CREATE FULL REPORT SNAPSHOT ====================
  async createSnapshot(tenantId: string, monthYear: string, createdById?: string, siteNames: string[] = []) {
    const dateRange = getMonthDateRange(monthYear)
    
    // Get tenant info
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
    if (!tenant) throw new Error('Tenant not found')
    
    // Aggregate all data
    const [overview, classificationStats, topEndpoints, topThreats, incidents, classifications, vulnerabilitiesRaw, criticalSamples, dataLeaks, networkActivity, riskyFiles] = await Promise.all([
      this.getIncidentOverview(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getClassificationStats(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getTopEndpoints(tenantId, dateRange.start, dateRange.end, 10, siteNames),
      this.getTopThreats(tenantId, dateRange.start, dateRange.end, 10, siteNames),
      this.getIncidentDetails(tenantId, dateRange.start, dateRange.end, 50, siteNames),
      this.getTopClassifications(tenantId, dateRange.start, dateRange.end, 5, siteNames),
      this.getVulnerabilities(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getCriticalEventsSample(tenantId, dateRange.start, dateRange.end, 10, siteNames),
      this.getDataLeaks(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getNetworkActivity(tenantId, dateRange.start, dateRange.end, siteNames),
      this.getRiskyFiles(tenantId, dateRange.start, dateRange.end, 15, siteNames)
    ])
    
    // 🔥 AI ENRICHMENT STEP: Normalize app names with AI
    const rawAppNames = [
        ...vulnerabilitiesRaw.appsByVulnerabilities.map((v: any) => v.application),
        ...vulnerabilitiesRaw.endpointsByVulnerabilities.map((v: any) => v.application)
    ]
    const appNameMapping = await this.normalizeAppNamesWithAI(rawAppNames, tenantId)
    
    // 🔥 APPLY MAPPING
    const vulnerabilities = {
        ...vulnerabilitiesRaw,
        appsByVulnerabilities: vulnerabilitiesRaw.appsByVulnerabilities.map((v: any) => {
            const prettyName = appNameMapping[v.application] || v.application
            return {
                ...v,
                application: prettyName,
                description: `Security events detected associated with ${prettyName}`
            }
        }),
        endpointsByVulnerabilities: vulnerabilitiesRaw.endpointsByVulnerabilities.map((v: any) => ({
            ...v,
            application: appNameMapping[v.application] || v.application
        }))
    }
    
    // Generate AI summaries
    const aiSummaries = await this.generateAISummaries({ overview, topEndpoints, topThreats, criticalSamples, vulnerabilities } as any, tenantId)
    
    // Build full report data
    const reportData: MdrReportData = {
      tenantId,
      tenantName: tenant.name,
      monthYear,
      dateRange,
      generatedAt: new Date().toISOString(),
      
      overview: {
        ...overview,
        classification: classificationStats  // 🔥 Threat category breakdown
      },
      topEndpoints,
      topThreats,
      classifications, // New Field
      incidents,
      incidentRecommendation: aiSummaries.incidentRecommendation,
      
      riskAssessment: {
        ...aiSummaries.riskAssessment,
        riskyFiles
      },
      
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
    
    if (!snapshot) {
      throw new Error('Report snapshot not found. Try regenerating the report.')
    }
    
    return {
      report,
      snapshot,
      data: snapshot.data as MdrReportData
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
