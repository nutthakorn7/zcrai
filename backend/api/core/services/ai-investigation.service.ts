
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// --- Mock Tools ---
const mockVirusTotal = async (ip: string) => {
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    return {
        source: 'VirusTotal',
        entity: ip,
        reputation: 'Malicious',
        score: '85/100',
        tags: ['botnet', 'c2-server', 'brute-force']
    };
};

const mockLogQuery = async (query: string) => {
    await new Promise(r => setTimeout(r, 1200));
    return {
        source: 'SIEM Logs',
        query: query,
        hits: 52,
        samples: [
            { timestamp: '2023-10-27T10:00:01Z', event: 'Failed Login', user: 'admin' },
            { timestamp: '2023-10-27T10:00:05Z', event: 'Failed Login', user: 'admin' }
        ],
        summary: 'High volume of failed login attempts detected in short window.'
    };
};

const mockUserLookup = async (username: string) => {
    await new Promise(r => setTimeout(r, 600));
    return {
        source: 'Active Directory',
        username: username,
        department: 'IT Operations',
        adminPrivileges: true,
        lastPasswordReset: '90 days ago'
    };
};

export class AIInvestigationService {

    static async investigate(alert: any) {
        console.log(`[AIInvestigationService] 🕵️ Starting Investigation for ${alert.id}`);

        try {
            // 1. Identify Entities & Run Tools (Parallel)
            // In a real agent, the AI would ask for these. Here we heuristically determine what to run.
            const toolPromises = [];
            const collectedEvidence: any[] = [];

            // Check for IP
            const targetIP = alert.observables?.find((o: any) => o.type === 'ip')?.value || 
                             alert.rawData?.source_ip || 
                             alert.rawData?.host_ip;
            
            if (targetIP) {
                console.log(`[AIInvestigationService] Checking Reputation for ${targetIP}...`);
                toolPromises.push(mockVirusTotal(targetIP).then(res => collectedEvidence.push(res)));
                console.log(`[AIInvestigationService] Querying Logs for ${targetIP}...`);
                toolPromises.push(mockLogQuery(`source_ip=${targetIP}`).then(res => collectedEvidence.push(res)));
            }

            // Check for User
            const targetUser = alert.rawData?.user_name || alert.rawData?.user;
            if (targetUser) {
                console.log(`[AIInvestigationService] Looking up User ${targetUser}...`);
                toolPromises.push(mockUserLookup(targetUser).then(res => collectedEvidence.push(res)));
            }

            // Wait for all tools
            await Promise.all(toolPromises);

            // 2. Generate Investigation Report with AI
            if (!genAI) {
                console.warn('[AIInvestigationService] Gemini Not Configured - Investigation Skipped');
                return;
            }

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const toolOutputText = collectedEvidence.map(e => `
            --- Tool Evidence: ${e.source} ---
            Entity: ${e.entity || e.username || e.query}
            Data: ${JSON.stringify(e, null, 2)}
            `).join('\n');

            const prompt = `
            You are an Autonomous AI Investigator.
            Your goal is to write a comprehensive Investigation Report for this Security Alert.

            **Alert Details**:
            - Title: ${alert.title}
            - Severity: ${alert.severity}
            - Description: ${alert.description}

            **Evidence Gathered by Tools**:
            ${toolOutputText || "No additional evidence found by automated tools."}

            **Instructions**:
            Write a professional Markdown report.
            Structure it as follows:
            1. **Executive Summary**: 1-2 sentences on what happened.
            2. **Key Findings**: Bullet points of the evidence (mention the VirusTotal score, Log patterns, etc.).
            3. **Timeline**: Reconstruct a brief timeline if possible.
            4. **Root Cause Analysis (Hypothesis)**: What is the likely attack vector?
            5. **Recommended Next Steps**: What should the human analyst do?

            Do not include JSON blocks, just readable Markdown text.
            `;

            console.log('[AIInvestigationService] Generating Report...');
            const result = await model.generateContent(prompt);
            const report = result.response.text();

            // 3. Save Report
            // We merge this into the existing aiAnalysis object
            const currentAnalysis = alert.aiAnalysis || {};
            await db.update(alerts)
                .set({
                    aiAnalysis: {
                        ...currentAnalysis,
                        investigationReport: report,
                        investigationStatus: 'completed',
                        investigatedAt: new Date().toISOString()
                    }
                })
                .where(eq(alerts.id, alert.id));

            console.log(`[AIInvestigationService] ✅ Report Generated for ${alert.id}`);

        } catch (error) {
            console.error('[AIInvestigationService] Investigation Failed:', error);
             await db.update(alerts)
                .set({
                    aiAnalysis: {
                        ...alert.aiAnalysis,
                        investigationStatus: 'failed'
                    }
                })
                .where(eq(alerts.id, alert.id));
        }
    }
}
