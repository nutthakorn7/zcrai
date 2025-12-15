import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { db } from '../../infra/db';
import { cases } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { LogsService } from './logs.service';
// CasesAPI usage removed as it's frontend-only.


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: `You are an Autonomous AI Investigator.
    Your goal is to analyze security logs and summarize findings to confirm or dismiss a threat.
    
    Input:
    - Alert Details
    - Related Logs (JSON)
    
    Output:
    - A concise investigation report in Markdown format.
    - Highlight key findings (e.g., "Found 50 failed logins from IP X").
    - Conclusion: Confirmed Threat / False Positive / Suspicious.
    `
});

export class AIInvestigationService {

    /**
     * Autonomously investigate an alert
     */
    static async investigate(alert: any) {
        console.log(`[AI-Investigator] Starting investigation for alert: ${alert.id}`);
        
        try {
            // 1. Plan: Determine what to search for
            // For now, we use a simple heuristic: Search for same IP or User in last 24h
            const tenantId = alert.tenantId;
            const targetIP = alert.rawData?.host_ip;
            const targetUser = alert.rawData?.user_name || alert.header?.user_name; // Adjust based on actual data shape
            
            if (!targetIP && !targetUser) {
                console.log('[AI-Investigator] No pivot points (IP/User) found. Skipping.');
                return;
            }

            // 2. Execute: Gather Evidence (Logs)
            // Search last 24 hours
            const endDate = new Date();
            const startDate = new Date();
            startDate.setHours(startDate.getHours() - 24);

            const filters: any = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            };
            
            if (targetIP) filters.search = targetIP; // Simple text search for IP for now, or use specific filter if available
            // LogsService.list signature: (tenantId, filters, pagination)
            // We need to check exact filter keys.
            
            const logsResult = await LogsService.list(tenantId, filters, { page: 1, limit: 50, sortBy: 'timestamp', sortOrder: 'desc' });
            const logs = logsResult.data;

            if (logs.length === 0) {
                 console.log('[AI-Investigator] No related logs found.');
                 return;
            }

            // 3. Analyze: Ask AI to summarize
            const prompt = `
            Alert: ${alert.title} (${alert.severity})
            Description: ${alert.description}
            
            Evidence (Recent Logs):
            ${JSON.stringify(logs.map((l: any) => ({
                time: l.timestamp,
                event: l.event_type,
                title: l.title,
                user: l.user_name,
                ip: l.host_ip
            })), null, 2)}
            
            Task:
            Summarize the evidence. Is there a pattern of attack?
            Generate a short "Investigation Report".
            `;

            const result = await model.generateContent(prompt);
            const report = result.response.text();

            // 4. Report: Save finding
            // If the alert is already linked to a case, add a comment.
            // If not, we might update the alert description or rawData.
            // For Phase 3, let's assume if it's High Severity TRue Positive, we might want to attach it to the alert metadata.
            // Schema has 'aiAnalysis'. We can append to it or use a new field.
            // Let's store it in 'aiAnalysis.investigationReport'.
            
            // Re-read alert to get current analysis
            const aiAnalysis = alert.aiAnalysis || {};
            aiAnalysis.investigationReport = report;

            await db.update(require('../../infra/db/schema').alerts)
                .set({ aiAnalysis })
                .where(eq(require('../../infra/db/schema').alerts.id, alert.id));
                
            console.log(`[AI-Investigator] Investigation complete for ${alert.id}`);

        } catch (e) {
            console.error('[AI-Investigator] Error:', e);
        }
    }
}
