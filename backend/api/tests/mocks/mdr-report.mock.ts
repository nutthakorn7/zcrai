/**
 * Mock Data for MDR Report Testing
 * This file provides realistic test data matching the MdrReportData interface
 */

// Define the type inline to avoid import issues
export interface MdrReportData {
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

export const mockMdrReportData: MdrReportData = {
  // Metadata
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  tenantName: 'บริษัท บุรีรัมย์ยูไนเต็ด จำกัด',
  monthYear: '2024-11',
  dateRange: {
    start: '2024-11-01',
    end: '2024-11-30'
  },
  generatedAt: new Date().toISOString(),

  // Section 1: Overview Incident Report
  overview: {
    threats: 156,
    mitigated: 142,
    malicious: 45,
    suspicious: 67,
    benign: 44,
    notMitigated: 14
  },

  // Section 1.1: Top 10 Endpoints with threats
  topEndpoints: [
    { name: 'DESKTOP-ACC001', count: 23 },
    { name: 'LAPTOP-HR-042', count: 18 },
    { name: 'SERVER-DB-01', count: 15 },
    { name: 'WS-FINANCE-007', count: 12 },
    { name: 'DESKTOP-IT-003', count: 11 },
    { name: 'LAPTOP-SALES-019', count: 9 },
    { name: 'SERVER-WEB-02', count: 8 },
    { name: 'WS-MARKETING-005', count: 7 },
    { name: 'DESKTOP-EXEC-001', count: 6 },
    { name: 'LAPTOP-ADMIN-008', count: 5 }
  ],

  // Section 1.2: Top 10 Threats
  topThreats: [
    { name: 'Trojan.GenericKD.46584321', count: 28 },
    { name: 'PUA.CryptoMiner.Win32', count: 22 },
    { name: 'Ransom.WannaCry.S5', count: 18 },
    { name: 'Exploit.CVE-2024-1234', count: 15 },
    { name: 'Adware.BrowserModifier', count: 14 },
    { name: 'Backdoor.Cobalt.Strike', count: 12 },
    { name: 'Trojan.Emotet.Gen', count: 10 },
    { name: 'Phishing.HTML.Generic', count: 9 },
    { name: 'Malware.Generic.Packed', count: 8 },
    { name: 'Spyware.Keylogger.Win64', count: 7 }
  ],

  // Section 2: Incident Details
  incidents: [
    {
      status: 'mitigated',
      threatDetails: 'Trojan.GenericKD.46584321',
      confidenceLevel: 'high',
      endpoint: 'DESKTOP-ACC001',
      classification: 'Trojan',
      hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
      path: 'C:\\Users\\admin\\Downloads\\invoice.exe'
    },
    {
      status: 'mitigated',
      threatDetails: 'PUA.CryptoMiner.Win32',
      confidenceLevel: 'critical',
      endpoint: 'SERVER-DB-01',
      classification: 'PUA',
      hash: 'b2c3d4e5f67890123456789012345678901abcde',
      path: 'C:\\Windows\\Temp\\svchost.exe'
    },
    {
      status: 'pending',
      threatDetails: 'Ransom.WannaCry.S5',
      confidenceLevel: 'critical',
      endpoint: 'LAPTOP-HR-042',
      classification: 'Ransomware',
      hash: 'c3d4e5f678901234567890123456789012abcdef',
      path: 'C:\\Users\\hr\\Desktop\\report.scr'
    },
    {
      status: 'resolved',
      threatDetails: 'Adware.BrowserModifier',
      confidenceLevel: 'medium',
      endpoint: 'WS-MARKETING-005',
      classification: 'Adware',
      hash: 'd4e5f6789012345678901234567890123abcdef0',
      path: 'C:\\Program Files\\FreeDownloader\\plugin.dll'
    },
    {
      status: 'mitigated',
      threatDetails: 'Backdoor.Cobalt.Strike',
      confidenceLevel: 'critical',
      endpoint: 'SERVER-WEB-02',
      classification: 'Backdoor',
      hash: 'e5f67890123456789012345678901234abcdef01',
      path: 'C:\\inetpub\\wwwroot\\shell.aspx'
    },
    {
      status: 'pending',
      threatDetails: 'Exploit.CVE-2024-1234',
      confidenceLevel: 'high',
      endpoint: 'DESKTOP-IT-003',
      classification: 'Exploit',
      hash: 'f678901234567890123456789012345abcdef012',
      path: 'C:\\Windows\\System32\\vulnerable.dll'
    },
    {
      status: 'mitigated',
      threatDetails: 'Trojan.Emotet.Gen',
      confidenceLevel: 'high',
      endpoint: 'LAPTOP-SALES-019',
      classification: 'Trojan',
      hash: '7890123456789012345678901234567abcdef0123',
      path: 'C:\\Users\\sales\\AppData\\Local\\Temp\\doc.exe'
    },
    {
      status: 'resolved',
      threatDetails: 'Phishing.HTML.Generic',
      confidenceLevel: 'medium',
      endpoint: 'DESKTOP-EXEC-001',
      classification: 'Phishing',
      hash: '890123456789012345678901234567abcdef01234',
      path: 'C:\\Users\\ceo\\Downloads\\invoice.html'
    }
  ],

  // Section 2.2: AI Generated Recommendation
  incidentRecommendation: `จากการวิเคราะห์ภัยคุกคามในเดือนพฤศจิกายน 2567 พบว่ามีจำนวน Threats ทั้งหมด 156 รายการ โดยสามารถ Mitigate ได้ 142 รายการ (91%)

**คำแนะนำเร่งด่วน:**
1. ตรวจสอบและแก้ไข 14 รายการที่ยังไม่ได้รับการ Mitigate โดยเฉพาะ Ransomware และ Exploit
2. อัพเดท Endpoint Protection บน DESKTOP-ACC001 และ LAPTOP-HR-042 ซึ่งมีจำนวน Threats สูง
3. ทบทวน Security Policy สำหรับการดาวน์โหลดไฟล์จากอินเทอร์เน็ต

**คำแนะนำระยะกลาง:**
- จัดอบรม Security Awareness ให้พนักงาน โดยเฉพาะเรื่อง Phishing และ Social Engineering
- ติดตั้ง EDR บน Server ที่พบ CryptoMiner และ Backdoor
- ทบทวน Network Segmentation เพื่อจำกัดการแพร่กระจายของ Malware`,

  // Section 3: Risk Assessment
  riskAssessment: {
    result: `**ระดับความเสี่ยง: ปานกลาง-สูง**

จากการประเมินความเสี่ยงด้านความปลอดภัยไซเบอร์ประจำเดือนพฤศจิกายน 2567 พบว่าองค์กรมีความเสี่ยงระดับปานกลาง-สูง เนื่องจาก:
- พบ Ransomware และ Backdoor บนระบบที่สำคัญ
- มี Threats 14 รายการที่ยังไม่ได้รับการแก้ไข
- Endpoint หลายเครื่องมีการติดเชื้อซ้ำ`,

    recommendation: `**คำแนะนำเชิงกลยุทธ์:**

1. **Immediate Actions (ภายใน 24-48 ชั่วโมง)**
   - Isolate และตรวจสอบ SERVER-WEB-02 ที่พบ Cobalt Strike
   - Patch ระบบที่มีช่องโหว่ CVE-2024-1234
   - Reset credentials ของ users ที่เครื่องติดเชื้อ

2. **Short-term (ภายใน 1-2 สัปดาห์)**
   - Deploy EDR solution ให้ครอบคลุมทุก Endpoint
   - ทบทวน Firewall Rules และ Network ACLs
   - ตั้งค่า Email Filtering เพิ่มเติม

3. **Long-term (ภายใน 1-3 เดือน)**
   - จัดทำ Incident Response Plan
   - ทำ Penetration Testing
   - พิจารณา SOC as a Service เพื่อ 24/7 Monitoring`
  },

  // Section 4: Vulnerability Application
  vulnerabilities: {
    appsByVulnerabilities: [
      {
        application: 'Microsoft Office 2019',
        cveCount: 8,
        topCve: 'CVE-2024-21413',
        highestSeverity: 'critical',
        description: 'Remote Code Execution vulnerability in Outlook'
      },
      {
        application: 'Adobe Acrobat Reader',
        cveCount: 5,
        topCve: 'CVE-2024-20731',
        highestSeverity: 'high',
        description: 'Use-after-free vulnerability leading to arbitrary code execution'
      },
      {
        application: 'Google Chrome',
        cveCount: 3,
        topCve: 'CVE-2024-0519',
        highestSeverity: 'high',
        description: 'Out of bounds memory access in V8'
      },
      {
        application: 'Java Runtime Environment',
        cveCount: 4,
        topCve: 'CVE-2024-20932',
        highestSeverity: 'medium',
        description: 'Security vulnerability in Oracle Java SE'
      },
      {
        application: 'WinRAR',
        cveCount: 2,
        topCve: 'CVE-2023-38831',
        highestSeverity: 'critical',
        description: 'Arbitrary code execution via crafted archive'
      }
    ],
    endpointsByVulnerabilities: [
      {
        application: 'Microsoft Office 2019',
        highestSeverity: 'critical',
        endpointCount: 45,
        topEndpoints: 'DESKTOP-ACC001, LAPTOP-HR-042, WS-FINANCE-007'
      },
      {
        application: 'Adobe Acrobat Reader',
        highestSeverity: 'high',
        endpointCount: 32,
        topEndpoints: 'LAPTOP-SALES-019, WS-MARKETING-005, DESKTOP-EXEC-001'
      },
      {
        application: 'Google Chrome',
        highestSeverity: 'high',
        endpointCount: 78,
        topEndpoints: 'All workstations'
      },
      {
        application: 'Java Runtime Environment',
        highestSeverity: 'medium',
        endpointCount: 15,
        topEndpoints: 'SERVER-DB-01, SERVER-WEB-02, DESKTOP-IT-003'
      }
    ],
    recommendation: `**คำแนะนำการแก้ไขช่องโหว่:**

1. **Critical Priority:**
   - อัพเดท Microsoft Office ไปเป็น version ล่าสุดทันที
   - อัพเดท WinRAR เป็น version 6.24 ขึ้นไป
   
2. **High Priority:**
   - อัพเดท Adobe Acrobat Reader DC ล่าสุด
   - เปิด Auto-update สำหรับ Google Chrome

3. **Medium Priority:**
   - ทบทวนความจำเป็นของ Java Runtime บนแต่ละเครื่อง
   - Disable Java plugin ใน browsers ที่ไม่จำเป็น

**หมายเหตุ:** ควรทำ Vulnerability Scan รอบถัดไปภายใน 2 สัปดาห์หลังจาก Patching`
  },

  // Section 5: Appendix - Glossary
  glossary: [
    { term: 'APT (Advanced Persistent Threat)', definition: 'การโจมตีไซเบอร์ที่ซับซ้อนและต่อเนื่อง โดยผู้โจมตีแทรกซึมเข้าสู่เครือข่ายและซ่อนตัวอยู่เป็นเวลานาน' },
    { term: 'CVE (Common Vulnerabilities and Exposures)', definition: 'ระบบมาตรฐานสำหรับระบุช่องโหว่ที่เป็นที่รู้จัก โดยแต่ละช่องโหว่จะมีรหัส CVE เฉพาะ' },
    { term: 'EDR (Endpoint Detection and Response)', definition: 'เทคโนโลยีรักษาความปลอดภัยที่ติดตาม ตรวจจับ และตอบสนองต่อภัยคุกคามบน Endpoint' },
    { term: 'IOC (Indicator of Compromise)', definition: 'หลักฐานทางนิติวิทยาศาสตร์ที่บ่งชี้ว่าระบบอาจถูกบุกรุก เช่น IP address, file hash, domain name' },
    { term: 'Lateral Movement', definition: 'เทคนิคที่ผู้โจมตีใช้เพื่อเคลื่อนย้ายผ่านเครือข่ายหลังจากได้ initial access' },
    { term: 'Malware', definition: 'ซอฟต์แวร์ที่ถูกออกแบบมาเพื่อทำลาย รบกวน หรือเข้าถึงระบบคอมพิวเตอร์โดยไม่ได้รับอนุญาต' },
    { term: 'MDR (Managed Detection and Response)', definition: 'บริการรักษาความปลอดภัยไซเบอร์ที่ผสมผสานเทคโนโลยีและความเชี่ยวชาญของผู้เชี่ยวชาญ' },
    { term: 'MITRE ATT&CK', definition: 'ฐานความรู้เกี่ยวกับกลยุทธ์และเทคนิคการโจมตีที่ใช้โดยผู้โจมตีจริง' },
    { term: 'Ransomware', definition: 'มัลแวร์ที่เข้ารหัสไฟล์ของเหยื่อและเรียกค่าไถ่เพื่อถอดรหัส' },
    { term: 'TTP (Tactics, Techniques, and Procedures)', definition: 'รูปแบบพฤติกรรมที่ผู้โจมตีใช้ในการโจมตีไซเบอร์' }
  ]
}

// Generate multiple test reports for different months
export function generateMockReports(): Array<{
  id: string
  tenantId: string
  monthYear: string
  status: 'draft' | 'approved' | 'sent' | 'error'
  pdfUrl: string | null
  approvedBy: string | null
  approvedAt: string | null
  sentAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}> {
  return [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      monthYear: '2024-11',
      status: 'draft',
      pdfUrl: null,
      approvedBy: null,
      approvedAt: null,
      sentAt: null,
      errorMessage: null,
      createdAt: '2024-12-01T10:00:00Z',
      updatedAt: '2024-12-01T10:00:00Z'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      monthYear: '2024-10',
      status: 'approved',
      pdfUrl: '/reports/550e8400-e29b-41d4-a716-446655440002/mdr_report_2024-10.pdf',
      approvedBy: '550e8400-e29b-41d4-a716-446655440099',
      approvedAt: '2024-11-05T14:30:00Z',
      sentAt: null,
      errorMessage: null,
      createdAt: '2024-11-01T09:00:00Z',
      updatedAt: '2024-11-05T14:30:00Z'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      monthYear: '2024-09',
      status: 'sent',
      pdfUrl: '/reports/550e8400-e29b-41d4-a716-446655440003/mdr_report_2024-09.pdf',
      approvedBy: '550e8400-e29b-41d4-a716-446655440099',
      approvedAt: '2024-10-03T11:00:00Z',
      sentAt: '2024-10-03T11:05:00Z',
      errorMessage: null,
      createdAt: '2024-10-01T08:00:00Z',
      updatedAt: '2024-10-03T11:05:00Z'
    }
  ]
}
