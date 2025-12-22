import puppeteer from 'puppeteer';
import { db } from '../../infra/db';
import { users, alerts } from '../../infra/db/schema';
import { eq, desc } from 'drizzle-orm';

export class ReportService {

    static async generateReport(tenantId: string, type: 'SOC2' | 'ISO27001'): Promise<Buffer> {
        // 1. Fetch Data
        const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));
        const recentAlerts = await db.select().from(alerts)
            .where(eq(alerts.tenantId, tenantId))
            .orderBy(desc(alerts.createdAt))
            .limit(20);

        // 2. Generate HTML Template
        const html = this.getTemplate(type, { users: tenantUsers, alerts: recentAlerts });

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

    private static getTemplate(type: string, data: any): string {
        const date = new Date().toLocaleDateString();
        
        // Common Styles
        const style = `
            <style>
                body { font-family: 'Helvetica', sans-serif; color: #333; line-height: 1.6; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #ddd; pb-4; }
                .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
                h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
                h2 { color: #444; border-left: 4px solid #4F46E5; padding-left: 10px; margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f3f4f6; font-weight: bold; }
                .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
                .badge-critical { background: #fee2e2; color: #991b1b; }
                .badge-high { background: #ffedd5; color: #9a3412; }
                .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #666; }
            </style>
        `;

        // Content
        let content = '';
        if (type === 'SOC2') {
            content = `
                <div class="header">
                    <div class="logo">zcrAI Compliance</div>
                    <h1>SOC 2 Type II - Access Control Audit</h1>
                    <p>Generated on: ${date}</p>
                </div>

                <h2>1. User Access Rights</h2>
                <p>List of all active accounts and their assigned roles.</p>
                <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>MFA Enabled</th><th>Status</th></tr></thead>
                    <tbody>
                        ${data.users.map((u: any) => `
                            <tr>
                                <td>${u.name || '-'}</td>
                                <td>${u.email}</td>
                                <td>${u.role}</td>
                                <td>${u.mfaEnabled ? 'Yes' : 'No'}</td>
                                <td>${u.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <h2>2. Recent Security Incidents</h2>
                <p>Review of recent alerts relevant to system security.</p>
                <table>
                    <thead><tr><th>Time</th><th>Title</th><th>Severity</th><th>Status</th></tr></thead>
                    <tbody>
                         ${data.alerts.map((a: any) => `
                            <tr>
                                <td>${new Date(a.createdAt).toLocaleString()}</td>
                                <td>${a.title}</td>
                                <td><span class="badge badge-${a.severity}">${a.severity}</span></td>
                                <td>${a.status}</td>
                            </tr>
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
                <h2>1. Incident Management Overview</h2>
                 <p>Summary of recent security incidents and response status.</p>
                <table>
                    <thead><tr><th>ID</th><th>Title</th><th>Source</th><th>Severity</th><th>Verdict</th></tr></thead>
                    <tbody>
                         ${data.alerts.map((a: any) => `
                            <tr>
                                <td>${a.id.slice(0,8)}</td>
                                <td>${a.title}</td>
                                <td>${a.source}</td>
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
            <html>
            <head>${style}</head>
            <body>
                ${content}
                <div class="footer">
                    <p>Confidential - Internal Use Only | Generated by zcrAI Platform</p>
                </div>
            </body>
            </html>
        `;
    }
}
