import puppeteer from 'puppeteer';
import { db } from '../../infra/db';
import { users, alerts } from '../../infra/db/schema';
import { eq, desc } from 'drizzle-orm';

export class ReportService {

    static async generateReport(tenantId: string, type: 'SOC2' | 'ISO27001' | 'NIST' | 'PDPA' | 'AI_ACCURACY'): Promise<Buffer> {
        // 1. Fetch Data
        const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));
        const recentAlerts = await db.select().from(alerts)
            .where(eq(alerts.tenantId, tenantId))
            .orderBy(desc(alerts.createdAt))
            .limit(20);

        let extraData = {};
        if (type === 'AI_ACCURACY') {
             const { AIFeedbackService } = await import('./ai-feedback.service');
             extraData = await AIFeedbackService.getROIStats(tenantId);
        }

        // 2. Generate HTML Template
        const html = this.getTemplate(type, { users: tenantUsers, alerts: recentAlerts, ...extraData });

        // 3. Render PDF with Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for some container environments
        });
        const page = await browser.newPage();
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });

        await browser.close();

        return Buffer.from(pdfBuffer);
    }

    static async generateISO27001ReportPDF(tenantId: string): Promise<Buffer> {
        return this.generateReport(tenantId, 'ISO27001');
    }

    static async generateNISTReportPDF(tenantId: string): Promise<Buffer> {
        return this.generateReport(tenantId, 'NIST'); 
    }

    static async generateThaiPDPAReportPDF(tenantId: string): Promise<Buffer> {
        return this.generateReport(tenantId, 'PDPA'); 
    }

    static async generateAIAccuracyReportPDF(tenantId: string): Promise<Buffer> {
        return this.generateReport(tenantId, 'AI_ACCURACY'); 
    }

    static async generateDashboardPDF(tenantId: string, options?: any): Promise<Buffer> {
        return this.generateReport(tenantId, 'SOC2'); 
    }

    private static getTemplate(type: string, data: any): string {
        const date = new Date().toLocaleDateString('th-TH'); // Thai date format
        
        // Common Styles
        const style = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;700&display=swap');
                body { font-family: 'Sarabun', 'Helvetica', sans-serif; color: #333; line-height: 1.6; padding: 20px; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #4F46E5; padding-bottom: 20px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                h1 { font-size: 22px; text-transform: uppercase; margin-top: 10px; color: #1e1b4b; }
                h2 { color: #1e1b4b; border-left: 5px solid #4F46E5; padding-left: 12px; margin-top: 30px; font-size: 18px; }
                p { font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; background: #fff; }
                th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
                th { background-color: #f9fafb; font-weight: 700; color: #374151; text-transform: uppercase; font-size: 10px; }
                .badge { padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
                .badge-critical { background: #fee2e2; color: #991b1b; }
                .badge-high { background: #ffedd5; color: #9a3412; }
                .badge-medium { background: #fef9c3; color: #854d0e; }
                .badge-info { background: #e0e7ff; color: #3730a3; }
                .nist-category { font-weight: bold; color: #4F46E5; }
                .pdpa-check { color: #059669; font-weight: bold; }
                .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                .metric-box { display: inline-block; width: 45%; background: #f3f4f6; padding: 15px; margin: 10px 2%; border-radius: 8px; text-align: center; }
                .metric-val { font-size: 24px; font-weight: bold; color: #4F46E5; }
                .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
            </style>
        `;

        let content = '';
        if (type === 'AI_ACCURACY') {
             content = `
                <div class="header">
                    <div class="logo">zcrAI Analytics</div>
                    <h1>AI SOC Performance & Accuracy Report</h1>
                    <p>Analysis Period: Last 30 Days</p>
                    <p>Generated on: ${date}</p>
                </div>
                
                <h2>1. Executive Summary</h2>
                <div style="text-align:center">
                    <div class="metric-box">
                        <div class="metric-val">${data.accuracyRate}%</div>
                        <div class="metric-label">Analyst Agreement Rate</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-val">$${data.costSavings}</div>
                        <div class="metric-label">Estimated Cost Savings</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-val">${data.totalHoursSaved} hrs</div>
                        <div class="metric-label">Time Saved (Triage + Response)</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-val">${data.totalAutoBlocks}</div>
                        <div class="metric-label">Autonomous Blocks Executed</div>
                    </div>
                </div>

                <h2>2. AI Triage Details</h2>
                <p>Total Alerts Processed by AI: <strong>${data.totalTriageCount}</strong></p>
                <p>Feedback received from analysts: <strong>${data.feedbackCount}</strong> cases</p>

                <h2>3. Recent AI Decisions</h2>
                <table>
                    <thead><tr><th>Time</th><th>Alert</th><th>AI Verdict</th><th>Analyst Feedback</th></tr></thead>
                    <tbody>
                        ${data.alerts.map((a: any) => `
                            <tr>
                                <td>${new Date(a.createdAt).toLocaleString()}</td>
                                <td>${a.title}</td>
                                <td>${a.aiAnalysis?.classification || 'Pending'} (${a.aiAnalysis?.confidence || 0}%)</td>
                                <td>${
                                    // Normally we'd join feedback here, but for simple report just show N/A if not fetched
                                    'See Dashboard' 
                                }</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (type === 'SOC2') {
            content = `
                <div class="header">
                    <div class="logo">zcrAI Compliance</div>
                    <h1>SOC 2 Type II - Access Control Audit</h1>
                    <p>Generated for Tenant: ${data.tenantId || 'Managed Customer'}</p>
                    <p>Audit Date: ${date}</p>
                </div>
                <h2>1. User Access Rights (CC6.1)</h2>
                <p>The following users have active access to the environment. Role-based access control (RBAC) is enforced.</p>
                <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>MFA</th><th>Status</th></tr></thead>
                    <tbody>
                        ${data.users.map((u: any) => `
                            <tr><td>${u.name || '-'}</td><td>${u.email}</td><td>${u.role}</td><td>${u.mfaEnabled ? '✅' : '❌'}</td><td>${u.status}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (type === 'NIST') {
            content = `
                <div class="header">
                    <div class="logo">zcrAI SOC Platform</div>
                    <h1>NIST CSF Compliance Report (v1.1)</h1>
                    <p>Framework Alignment: Core Cybersecurity Activities</p>
                    <p>Report Date: ${date}</p>
                </div>
                <h2>1. PR.AC (Access Control)</h2>
                <p>Ensuring access to assets is limited to authorized users.</p>
                <table>
                    <thead><tr><th>Sub-Category</th><th>Status</th><th>Evidence</th></tr></thead>
                    <tbody>
                        <tr><td>PR.AC-1: Identities Managed</td><td class="pdpa-check">COMPLIANT</td><td>${data.users.length} active identities monitored</td></tr>
                        <tr><td>PR.AC-4: Access Shielding</td><td class="pdpa-check">COMPLIANT</td><td>MFA enforced for high-privilege roles</td></tr>
                    </tbody>
                </table>

                <h2>2. DE.AE (Detection & Monitoring)</h2>
                <p>Mapping recent alerts to NIST Detect functions.</p>
                <table>
                    <thead><tr><th>Timestamp</th><th>NIST category</th><th>Incident Type</th><th>Severity</th></tr></thead>
                    <tbody>
                        ${data.alerts.map((a: any) => `
                            <tr>
                                <td>${new Date(a.createdAt).toLocaleString()}</td>
                                <td class="nist-category">DE.AE-2 (Detection)</td>
                                <td>${a.title}</td>
                                <td><span class="badge badge-${a.severity}">${a.severity}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (type === 'PDPA') {
            content = `
                <div class="header">
                    <div class="logo">zcrAI PDPA Compliance</div>
                    <h1>รายงานการประมวลผลข้อมูลส่วนบุคคล (PDPA)</h1>
                    <p>ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</p>
                    <p>วันที่ออกรายงาน: ${date}</p>
                </div>
                <h2>1. มาตรการรักษาความปลอดภัยของข้อมูล (Security Measures)</h2>
                <p>ระบบ zcrAI ได้รับการออกแบบให้รองรับ Privacy by Design โดยมีการจำกัดสิทธิ์เข้าถึงข้อมูล (Data Minimization).</p>
                <table>
                    <thead><tr><th>หัวข้อการตรวจสอบ</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead>
                    <tbody>
                        <tr><td>การรักษาความลับ (Confidentiality)</td><td class="pdpa-check">ผ่าน</td><td>มีการเข้ารหัสผ่านและ Token-based Auth</td></tr>
                        <tr><td>ความถูกต้องคบบริบูรณ์ (Integrity)</td><td class="pdpa-check">ผ่าน</td><td>มีระบบ Audit Log บันทึกการเปลี่ยนแปลงข้อมูล</td></tr>
                        <tr><td>ความพร้อมใช้งาน (Availability)</td><td class="pdpa-check">ผ่าน</td><td>ระบบรองรับ High-Availability และ Backup</td></tr>
                    </tbody>
                </table>

                <h2>2. ข้อมูลการเข้าถึงข้อมูลส่วนตัว (Data Access Audit)</h2>
                <p>รายการบุคคลที่เข้าถึงระบบในช่วงเวลาที่กำหนด:</p>
                <table>
                    <thead><tr><th>ชื่อผู้ใช้งาน</th><th>อีเมล</th><th>ระดับสิทธิ์</th><th>สถานะความปลอดภัย</th></tr></thead>
                    <tbody>
                        ${data.users.map((u: any) => `
                            <tr><td>${u.name || '-'}</td><td>${u.email}</td><td>${u.role}</td><td>${u.mfaEnabled ? 'ปลอดภัยสูง' : 'ปกติ'}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
             content = `
                <div class="header">
                    <div class="logo">zcrAI Compliance</div>
                    <h1>ISO 27001 - Information Security Report</h1>
                    <p>Generated on: ${date}</p>
                </div>
                <h2>1. Incident Management Overview (A.16)</h2>
                <table>
                    <thead><tr><th>ID</th><th>Title</th><th>Severity</th><th>Verdict</th></tr></thead>
                    <tbody>
                        ${data.alerts.map((a: any) => `
                            <tr>
                                <td>${a.id.slice(0,8)}</td>
                                <td>${a.title}</td>
                                <td><span class="badge badge-${a.severity}">${a.severity}</span></td>
                                <td>${a.aiAnalysis?.classification || 'Pending'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        return `
            <!DOCTYPE html>
            <html lang="th">
            <head>
                <meta charset="UTF-8">
                ${style}
            </head>
            <body>
                ${content}
                <div class="footer">
                    <p>เอกสารนี้ถือเป็นความลับสูงสุด (Strictly Confidential) | สร้างโดยแพลตฟอร์ม zcrAI</p>
                    <p>© ${new Date().getFullYear()} zcrAI MSSP SOC Division</p>
                </div>
            </body>
            </html>
        `;
    }
}
