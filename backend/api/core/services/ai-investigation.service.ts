
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { VirusTotalProvider } from '../enrichment-providers/virustotal';
import { AbuseIPDBProvider } from '../enrichment-providers/abuseipdb';
import { AlienVaultOTXProvider } from '../enrichment-providers/alienvault-otx';
import { clickhouse } from '../../infra/clickhouse/client';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// --- Constants ---
const MAX_STEPS = 5;

// --- Real Tool Providers ---
const virusTotalProvider = new VirusTotalProvider();
const abuseIPDBProvider = new AbuseIPDBProvider();
const alienVaultProvider = new AlienVaultOTXProvider();

// --- Tool Implementations ---
const checkThreatIntel = async (ip: string) => {
    const results: any[] = [];
    
    try {
        console.log(`[Agent] 🔍 VirusTotal: ${ip}`);
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
        console.warn(`[Agent] VirusTotal failed: ${error.message}`);
    }
    
    try {
        console.log(`[Agent] 🛡️ AbuseIPDB: ${ip}`);
        const abuseResult = await abuseIPDBProvider.checkIP(ip);
        results.push({
            source: 'AbuseIPDB',
            entity: ip,
            abuseConfidenceScore: abuseResult.abuseConfidenceScore || 0,
            totalReports: abuseResult.totalReports || 0,
            isWhitelisted: abuseResult.isWhitelisted || false
        });
    } catch (error: any) {
        console.warn(`[Agent] AbuseIPDB failed: ${error.message}`);
    }
    
    try {
        console.log(`[Agent] 👽 AlienVault OTX: ${ip}`);
        const otxResult = await alienVaultProvider.checkIP(ip);
        results.push({
            source: 'AlienVault OTX',
            entity: ip,
            pulseCount: otxResult.pulseCount || 0,
            tags: otxResult.tags || [],
            malicious: (otxResult.pulseCount || 0) > 0
        });
    } catch (error: any) {
        console.warn(`[Agent] AlienVault OTX failed: ${error.message}`);
    }
    
    return {
        tool: 'threat_intel',
        entity: ip,
        providers: results,
        summary: `Checked ${results.length}/3 threat intel sources for ${ip}`
    };
};

const queryLogs = async (ip: string, hours: number = 24) => {
    try {
        console.log(`[Agent] 📊 ClickHouse: Logs for ${ip} (${hours}h)`);
        const query = `
            SELECT timestamp, event_type, source_ip, dest_ip, user_name, host_name, process_name, result
            FROM events
            WHERE (source_ip = '${ip}' OR dest_ip = '${ip}')
            AND timestamp >= now() - INTERVAL ${hours} HOUR
            ORDER BY timestamp DESC
            LIMIT 50
        `;
        
        const result = await clickhouse.query({ query });
        const rows = await result.json();
        const data = rows.data || [];
        
        return {
            tool: 'query_logs',
            entity: ip,
            hits: data.length,
            samples: data.slice(0, 5).map((row: any) => ({
                timestamp: row.timestamp,
                event: row.event_type || 'Unknown',
                user: row.user_name || 'N/A',
                host: row.host_name || 'N/A'
            })),
            summary: data.length > 0 
                ? `Found ${data.length} events for ${ip} in past ${hours}h` 
                : `No events found for ${ip}`
        };
    } catch (error: any) {
        console.warn(`[Agent] ClickHouse failed: ${error.message}`);
        return {
            tool: 'query_logs',
            entity: ip,
            hits: 0,
            samples: [],
            summary: 'Log query failed - ClickHouse unavailable'
        };
    }
};

const lookupUser = async (username: string) => {
    console.log(`[Agent] 👤 User Lookup: ${username}`);
    // Mock for now - would connect to AD/LDAP
    return {
        tool: 'user_lookup',
        entity: username,
        department: 'IT Operations',
        adminPrivileges: true,
        lastLogin: '2 hours ago',
        riskScore: 35,
        summary: `User ${username}: IT Ops admin, moderate risk`
    };
};

const lookupHash = async (hash: string) => {
    console.log(`[Agent] 🔐 Hash Lookup: ${hash}`);
    try {
        const vtResult = await virusTotalProvider.enrichHash(hash);
        return {
            tool: 'hash_lookup',
            entity: hash,
            malicious: vtResult.malicious || false,
            detectionRatio: vtResult.detectionRatio || '0/0',
            summary: vtResult.malicious 
                ? `Hash ${hash.slice(0,12)}... is MALICIOUS (${vtResult.detectionRatio})`
                : `Hash ${hash.slice(0,12)}... appears clean`
        };
    } catch (error: any) {
        return {
            tool: 'hash_lookup',
            entity: hash,
            malicious: false,
            summary: `Hash lookup failed: ${error.message}`
        };
    }
};

// --- Tool Registry ---
const TOOL_REGISTRY: Record<string, { description: string; params: string[]; fn: Function | null }> = {
    threat_intel: {
        description: 'Check IP reputation against VirusTotal, AbuseIPDB, AlienVault OTX',
        params: ['ip'],
        fn: checkThreatIntel
    },
    query_logs: {
        description: 'Query SIEM logs for IP activity in past N hours',
        params: ['ip', 'hours'],
        fn: queryLogs
    },
    user_lookup: {
        description: 'Look up user in Active Directory/LDAP',
        params: ['username'],
        fn: lookupUser
    },
    hash_lookup: {
        description: 'Check file hash against VirusTotal',
        params: ['hash'],
        fn: lookupHash
    },
    conclude: {
        description: 'Finish investigation - no more tools needed',
        params: [],
        fn: null
    }
};

// --- Agent Loop ---
export class AIInvestigationService {

    /**
     * Multi-Step Investigation with AI Agent Loop
     */
    static async investigate(alert: any) {
        console.log(`\n[AIAgent] 🕵️ Starting Multi-Step Investigation for ${alert.id}`);
        console.log(`[AIAgent] ────────────────────────────────────────────────`);

        const evidence: any[] = [];
        const steps: { step: number; tool: string; result: any }[] = [];

        try {
            if (!process.env.GEMINI_API_KEY) {
                console.warn('[AIAgent] Gemini Not Configured - Using Single-Pass Mode');
                // Fallback: Run threat intel if IP exists
                const ip = alert.observables?.find((o: any) => o.type === 'ip')?.value || 
                           alert.rawData?.dest_ip || alert.rawData?.source_ip;
                if (ip) {
                    const result = await checkThreatIntel(ip);
                    evidence.push(result);
                }
                await this.generateReport(alert, evidence, steps);
                return;
            }

            // Apply Rate Limiting for Gemini (Free tier ~15 RPM)
            const { RateLimitService } = await import('./rate-limit.service');
            await RateLimitService.consume('gemini', 1);

            const model = genAI!.getGenerativeModel({ 
                model: "gemini-1.5-flash"
            });

            // Extract available entities from alert
            const entities = this.extractEntities(alert);
            
            // --- Agent Loop ---
            for (let step = 1; step <= MAX_STEPS; step++) {
                console.log(`\n[AIAgent] Step ${step}/${MAX_STEPS}`);
                
                const toolSelection = await this.selectTool(model, alert, entities, evidence, step);
                console.log(`[AIAgent] Decision: ${toolSelection.tool} - ${toolSelection.reasoning}`);
                
                if (toolSelection.tool === 'conclude') {
                    console.log(`[AIAgent] ✓ Investigation concluded at step ${step}`);
                    break;
                }

                const toolDef = TOOL_REGISTRY[toolSelection.tool];
                if (!toolDef || !toolDef.fn) {
                    console.warn(`[AIAgent] Unknown tool: ${toolSelection.tool}`);
                    continue;
                }

                // Execute tool
                const params = toolSelection.params || {};
                const result = await toolDef.fn(
                    params.ip || params.username || params.hash || entities.ip || entities.username,
                    params.hours || 24
                );
                
                evidence.push(result);
                steps.push({ step, tool: toolSelection.tool, result });
                
                console.log(`[AIAgent] Result: ${result.summary || JSON.stringify(result).slice(0, 100)}`);
            }

            console.log(`\n[AIAgent] ────────────────────────────────────────────────`);
            console.log(`[AIAgent] Generating final report with ${evidence.length} evidence items...`);
            
            await this.generateReport(alert, evidence, steps);
            
        } catch (error: any) {
            console.error('[AIAgent] Investigation Failed:', error.message);
            await db.update(alerts)
                .set({
                    aiAnalysis: {
                        ...alert.aiAnalysis,
                        investigationStatus: 'failed',
                        error: error.message
                    }
                })
                .where(eq(alerts.id, alert.id));
        }
    }

    /**
     * Extract entities (IP, user, hash) from alert
     */
    private static extractEntities(alert: any) {
        return {
            ip: alert.observables?.find((o: any) => o.type === 'ip')?.value || 
                alert.rawData?.dest_ip || alert.rawData?.source_ip || alert.rawData?.host_ip,
            username: alert.rawData?.user_name || alert.rawData?.user,
            hash: alert.observables?.find((o: any) => o.type === 'hash')?.value ||
                  alert.rawData?.file_hash || alert.rawData?.sha256
        };
    }

    /**
     * Ask AI which tool to run next
     */
    private static async selectTool(
        model: any, 
        alert: any, 
        entities: any, 
        evidence: any[], 
        step: number
    ): Promise<{ tool: string; params?: any; reasoning: string }> {
        
        const toolList = Object.entries(TOOL_REGISTRY)
            .map(([name, def]) => `- ${name}: ${def.description}`)
            .join('\n');

        const evidenceSummary = evidence.length > 0
            ? evidence.map(e => `[${e.tool}] ${e.summary}`).join('\n')
            : 'No evidence collected yet.';

        const prompt = `
You are an AI Security Investigator. Decide which tool to run next.

**Alert:**
- Title: ${alert.title}
- Severity: ${alert.severity}
- Description: ${alert.description}

**Available Entities:**
- IP: ${entities.ip || 'None'}
- User: ${entities.username || 'None'}
- Hash: ${entities.hash || 'None'}

**Evidence Collected So Far:**
${evidenceSummary}

**Available Tools:**
${toolList}

**Step ${step}/${MAX_STEPS}**

Decide which tool to run next. If you have enough information, choose "conclude".
Think step-by-step: What do we know? What's missing? What tool would help most?

Return JSON: { "tool": "tool_name", "params": { "ip": "..." }, "reasoning": "..." }
`;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            return JSON.parse(text);
        } catch (error: any) {
            console.warn(`[AIAgent] Tool selection failed: ${error.message}`);
            // Default: run threat intel if IP exists
            if (entities.ip && evidence.length === 0) {
                return { tool: 'threat_intel', params: { ip: entities.ip }, reasoning: 'Fallback: Check IP reputation' };
            }
            return { tool: 'conclude', reasoning: 'Fallback: Unable to determine next step' };
        }
    }

    /**
     * Generate final investigation report
     */
    private static async generateReport(alert: any, evidence: any[], steps: any[]) {
        if (!genAI) {
            const mockReport = `## Investigation Report\n\n**Alert:** ${alert.title}\n\n**Findings:**\n${evidence.map(e => `- ${e.summary}`).join('\n') || 'No findings'}\n\n*Note: AI not configured, limited analysis performed.*`;
            await this.saveReport(alert, mockReport, evidence, steps);
            return;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const evidenceText = evidence.map(e => `
### ${e.tool || 'Tool'} - ${e.entity || 'N/A'}
${JSON.stringify(e, null, 2)}
        `).join('\n');

        const stepsText = steps.map(s => `Step ${s.step}: ${s.tool}`).join(' → ');

        const prompt = `
You are an AI Security Analyst. Write a professional Investigation Report.

**Alert:**
- Title: ${alert.title}
- Severity: ${alert.severity}
- Description: ${alert.description}

**Investigation Steps Taken:**
${stepsText || 'Single-pass analysis'}

**Collected Evidence:**
${evidenceText || 'No additional evidence'}

**Write a Markdown report with:**
1. Executive Summary (2-3 sentences)
2. Key Findings (bullet points)
3. Risk Assessment (Low/Medium/High/Critical)
4. Recommended Actions

Be concise but thorough. Do not use JSON blocks.
`;

        try {
            const result = await model.generateContent(prompt);
            const report = result.response.text();
            await this.saveReport(alert, report, evidence, steps);
        } catch (error: any) {
            console.error('[AIAgent] Report generation failed:', error.message);
            const fallbackReport = `## Investigation Report\n\n**Alert:** ${alert.title}\n\n**Error:** Report generation failed.\n\n**Raw Evidence:**\n${evidence.map(e => `- ${e.summary}`).join('\n')}`;
            await this.saveReport(alert, fallbackReport, evidence, steps);
        }
    }

    /**
     * Save report to database
     */
    private static async saveReport(alert: any, report: string, evidence: any[], steps: any[]) {
        const currentAnalysis = alert.aiAnalysis || {};
        await db.update(alerts)
            .set({
                aiAnalysis: {
                    ...currentAnalysis,
                    investigationReport: report,
                    investigationEvidence: evidence,
                    investigationSteps: steps.map(s => s.tool),
                    investigationStatus: 'completed',
                    investigatedAt: new Date().toISOString()
                }
            })
            .where(eq(alerts.id, alert.id));

        console.log(`[AIAgent] ✅ Report saved for ${alert.id}`);
    }
}
