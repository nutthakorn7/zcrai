
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { VirusTotalProvider } from '../enrichment-providers/virustotal';
import { AbuseIPDBProvider } from '../enrichment-providers/abuseipdb';
import { AlienVaultOTXProvider } from '../enrichment-providers/alienvault-otx';
import { clickhouse } from '../../infra/clickhouse/client';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// --- Real Tool: Threat Intelligence Providers ---
const virusTotalProvider = new VirusTotalProvider();
const abuseIPDBProvider = new AbuseIPDBProvider();
const alienVaultProvider = new AlienVaultOTXProvider();

const checkThreatIntel = async (ip: string) => {
    const results: any[] = [];
    
    // VirusTotal
    try {
        console.log(`[AIInvestigation] 🔍 Calling VirusTotal API for ${ip}...`);
        const vtResult = await virusTotalProvider.enrichIP(ip);
        results.push({
            source: 'VirusTotal',
            entity: ip,
            reputation: vtResult.reputation || 0,
            detectionRatio: vtResult.detectionRatio || '0/0',
            malicious: vtResult.malicious || false,
            country: vtResult.country || 'Unknown'
        });
    } catch (error: any) {
        console.warn(`[AIInvestigation] VirusTotal failed: ${error.message}`);
    }
    
    // AbuseIPDB
    try {
        console.log(`[AIInvestigation] 🛡️ Calling AbuseIPDB for ${ip}...`);
        const abuseResult = await abuseIPDBProvider.checkIP(ip);
        results.push({
            source: 'AbuseIPDB',
            entity: ip,
            abuseConfidenceScore: abuseResult.abuseConfidenceScore || 0,
            totalReports: abuseResult.totalReports || 0,
            isWhitelisted: abuseResult.isWhitelisted || false,
            countryCode: abuseResult.countryCode || 'Unknown'
        });
    } catch (error: any) {
        console.warn(`[AIInvestigation] AbuseIPDB failed: ${error.message}`);
    }
    
    // AlienVault OTX
    try {
        console.log(`[AIInvestigation] 👽 Calling AlienVault OTX for ${ip}...`);
        const otxResult = await alienVaultProvider.checkIP(ip);
        results.push({
            source: 'AlienVault OTX',
            entity: ip,
            pulseCount: otxResult.pulseCount || 0,
            tags: otxResult.tags || [],
            malicious: (otxResult.pulseCount || 0) > 0
        });
    } catch (error: any) {
        console.warn(`[AIInvestigation] AlienVault OTX failed: ${error.message}`);
    }
    
    return {
        source: 'Threat Intelligence (Combined)',
        entity: ip,
        providers: results,
        summary: `Checked ${results.length}/3 threat intel sources`
    };
};

// --- Real Tool: ClickHouse Log Query ---
const queryLogs = async (ip: string, hours: number = 24) => {
    try {
        console.log(`[AIInvestigation] 📊 Querying ClickHouse for IP ${ip}...`);
        
        const query = `
            SELECT 
                timestamp,
                event_type,
                source_ip,
                dest_ip,
                user_name,
                host_name,
                process_name,
                result
            FROM events
            WHERE (source_ip = '${ip}' OR dest_ip = '${ip}')
            AND timestamp >= now() - INTERVAL ${hours} HOUR
            ORDER BY timestamp DESC
            LIMIT 50
        `;
        
        const result = await clickhouse.query({ query });
        const rows = await result.json();
        
        if (!rows || rows.data?.length === 0) {
            return {
                source: 'ClickHouse SIEM',
                query: `Events for IP ${ip}`,
                hits: 0,
                samples: [],
                summary: 'No recent logs found for this IP in the past 24 hours.'
            };
        }
        
        const data = rows.data || [];
        return {
            source: 'ClickHouse SIEM',
            query: `Events for IP ${ip}`,
            hits: data.length,
            samples: data.slice(0, 5).map((row: any) => ({
                timestamp: row.timestamp,
                event: row.event_type || 'Unknown Event',
                user: row.user_name || 'N/A',
                host: row.host_name || 'N/A',
                result: row.result || 'N/A'
            })),
            summary: `Found ${data.length} events in the past ${hours} hours.`
        };
    } catch (error: any) {
        console.warn(`[AIInvestigation] ClickHouse query failed: ${error.message}. Using fallback.`);
        // Fallback to mock data
        return {
            source: 'SIEM Logs (Fallback)',
            query: `Events for IP ${ip}`,
            hits: 12,
            samples: [
                { timestamp: new Date().toISOString(), event: 'Failed Login', user: 'admin' },
                { timestamp: new Date().toISOString(), event: 'Failed Login', user: 'admin' }
            ],
            summary: 'ClickHouse unavailable, using sample data.'
        };
    }
};

// --- Mock Tool: User Lookup (Keep for now) ---
const mockUserLookup = async (username: string) => {
    await new Promise(r => setTimeout(r, 600));
    return {
        source: 'Active Directory (Mock)',
        username: username,
        department: 'IT Operations',
        adminPrivileges: true,
        lastPasswordReset: '90 days ago',
        note: 'Mock data - AD/LDAP integration pending'
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
                console.log(`[AIInvestigationService] Running Threat Intel lookups for ${targetIP}...`);
                toolPromises.push(checkThreatIntel(targetIP).then((res: any) => collectedEvidence.push(res)));
                console.log(`[AIInvestigationService] Querying Logs for ${targetIP}...`);
                toolPromises.push(queryLogs(targetIP).then((res: any) => collectedEvidence.push(res)));
            }

            // Check for User
            const targetUser = alert.rawData?.user_name || alert.rawData?.user;
            if (targetUser) {
                console.log(`[AIInvestigationService] Looking up User ${targetUser}...`);
                toolPromises.push(mockUserLookup(targetUser).then((res: any) => collectedEvidence.push(res)));
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
