import { AIProvider, AIPlaybookSuggestion } from "../ai/types";
import { MockAIProvider } from "../ai/mock.provider";
import { GeminiProvider } from "../ai/gemini.provider";

export class AIService {
    private static provider: AIProvider;

    static initialize() {
        const geminiKey = process.env.GEMINI_API_KEY;

        if (geminiKey) {
            console.log("[AIService] Using Google Gemini");
            this.provider = new GeminiProvider(geminiKey);
        } else {
            console.log("[AIService] No Gemini API Key found, using Mock Provider");
            this.provider = new MockAIProvider();
        }
    }

    static async summarizeCase(caseData: any): Promise<{ summary: string, verdict: string, confidence: number, evidence_analysis: string }> {
        if (!this.provider) this.initialize();

        const prompt = `
You are a designated Tier-3 SOC Analyst AI (zcrAI).
Analyze the following Security Incident Case to determine if it is a True Positive or False Positive.

**Case Details**:
- Title: ${caseData.title}
- Severity: ${caseData.severity}
- Description: ${caseData.description}
- Alert Count: ${caseData.alerts?.length || 0}

**Alerts**:
${caseData.alerts?.map((a: any) => `- [${a.severity}] ${a.title}: ${a.description}`).join('\n') || "No correlated alerts."}

**Instructions**:
1. Analyze the indicators (IPs, domains, hashes) and behavior ONLY based on the provided Case Details and Alerts.
2. DO NOT use external knowledge, internet data, or general information not present in the provided context.
3. Determine a **Verdict**: "True Positive", "False Positive", or "Suspicious" (if unsure).
4. Assign a **Confidence Score** (0-100).
5. Provide a **Summary** of the incident based strictly on internal evidence.
6. Provide a detailed **Evidence Analysis** (bullet points).

**Output Format**:
Return valid JSON only.
{
  "summary": "Markdown summary...",
  "verdict": "True Positive" | "False Positive" | "Suspicious",
  "confidence": number,
  "evidence_analysis": "Markdown analysis..."
}
`;
        const text = await this.provider.generateText(prompt);
        try {
            const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse AI Summary JSON", text);
            return { 
                summary: text, 
                verdict: "Suspicious", 
                confidence: 0, 
                evidence_analysis: "Failed to parse structured analysis." 
            };
        }
    }

    static async generalChat(messages: { role: string, content: string }[], context?: string): Promise<string> {
        if (!this.provider) this.initialize();

        const prompt = `
You are a designated Tier-3 SOC Analyst AI (zcrAI).
Answer the user's latest query based on the conversation history and provided Internal Context.

**Internal Context**:
${context || "No internal context provided."}

**Conversation History**:
${messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')}

**Instructions**:
1. Provide a concise, professional response based STRICTLY on the Internal Context.
2. If the answer is not in the context, explicitly state "I don't have enough internal information to answer this."
3. DO NOT use external knowledge, internet data, or general AI training for environment-specific details.
4. Use markdown for formatting.
`;
        return await this.provider.generateText(prompt);
    }

    static async streamChat(messages: { role: string, content: string }[], context?: string, callback?: (chunk: string) => void): Promise<void> {
        if (!this.provider) this.initialize();

        const prompt = `
You are a designated Tier-3 SOC Analyst AI (zcrAI).
Answer the user's latest query based on the conversation history and provided context.

**Context**:
${context || "No context provided."}

**Conversation History**:
${messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')}

**Instructions**:
1. Provide a concise, professional, and actionable response.
2. Use markdown for formatting.
3. STRICTLY use only the provided Context and Conversation History to answer. 
4. If the answer is not in the provided context, state that "I don't have enough internal information to answer this."
5. DO NOT use external sources, internet data, or general pre-trained knowledge to answer specific security questions about this environment.
`;
        if (callback) {
            await this.provider.streamText(prompt, callback);
        } else {
            await this.provider.generateText(prompt);
        }
    }

    static async suggestPlaybook(caseData: any, playbooks: any[]): Promise<AIPlaybookSuggestion> {
        if (!this.provider) this.initialize();

        const pbList = playbooks.map(p => `- [ID: ${p.id}] "${p.title}": ${p.description}`).join('\n');

        const prompt = `
You are a SOAR Expert.
Analyze the following Security Incident Case and available Playbooks.
Recommend the ONE most suitable playbook to run.

**Case**:
- Title: ${caseData.title}
- Description: ${caseData.description}
- Severity: ${caseData.severity}
- Alerts: ${caseData.alerts?.map((a: any) => a.title).join(', ')}

**Available Playbooks**:
${pbList}

**Instruction**:
Return valid JSON only. Format:
{
  "playbookId": "UUID" or null,
  "confidence": number (0-100),
  "reasoning": "Short explanation"
}
`;
        const text = await this.provider.generateText(prompt);
        try {
            const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse AI JSON", text);
            return { playbookId: null, confidence: 0, reasoning: "Failed to parse AI response." };
        }
    }

    static async generateQuery(userPrompt: string): Promise<{ sql: string | null, filters: any, explanation: string }> {
        if (!this.provider) this.initialize();

        const schemaContext = `
Table: normalized_logs
Columns:
- timestamp (DateTime)
- severity (String: critical, high, medium, low, info)
- event_type (String)
- source (String: sentinelone, crowdstrike, etc.)
- tenant_id (UUID)
- host.name, host.ip (String)
- user.name (String)
- network.src_ip, network.dst_ip (String)
`;

        const prompt = `
You are a Database Expert.
Convert the following Natural Language Query into a ClickHouse SQL WHERE clause (and equivalent JSON filters).
User Query: "${userPrompt}"

Context:
${schemaContext}

Instructions:
1. Return valid JSON only.
2. "sql": A valid SQL WHERE clause (e.g., "severity = 'high' AND timestamp > now() - INTERVAL 1 DAY"). Do NOT include "WHERE".
3. "filters": A simplified JSON object for UI filters (keys: severity, source, ip, user, timeRange).
4. "explanation": A very short explanation of what you did.

JSON Format:
{
  "sql": "string",
  "filters": {},
  "explanation": "string"
}
`;
        const text = await this.provider.generateText(prompt);
        try {
            const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse AI Query JSON", text);
            return { sql: null, filters: {}, explanation: "Failed to generate query." };
        }
    }

    /**
     * Triage alerts and assign urgency scores
     */
    static async triageAlerts(alerts: any[]): Promise<{ triaged: { id: string; urgency: number; category: string; reason: string; action: string }[] }> {
        if (!this.provider) this.initialize();

        // Limit to top 20 alerts to avoid token limits
        const alertsToAnalyze = alerts.slice(0, 20);

        const alertsSummary = alertsToAnalyze.map((a, i) => 
            `${i + 1}. [ID: ${a.id}] [${a.severity}] ${a.title} - Source: ${a.source || 'unknown'}, Time: ${a.timestamp || 'unknown'}`
        ).join('\n');

        const prompt = `
You are a SOC Triage AI. Analyze these security alerts and prioritize them by urgency.

**Alerts:**
${alertsSummary}

**Instructions:**
1. Score each alert's URGENCY from 0-100 based on:
   - Severity (critical=high base, info=low base)
   - Potential impact
   - Attack chain correlation
   - Time sensitivity
2. Categorize each: "active_attack", "lateral_movement", "data_exfil", "persistence", "recon", "policy_violation", "noise"
3. Provide a 1-line reason why this urgency score
4. Suggest immediate action: "investigate_now", "create_case", "enrich_iocs", "monitor", "dismiss"

**Output JSON array (maintain alert order):**
[
  { "id": "alert_id", "urgency": 85, "category": "active_attack", "reason": "...", "action": "investigate_now" },
  ...
]
Return ONLY the JSON array.
`;
        const text = await this.provider.generateText(prompt);
        try {
            const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
            const triaged = JSON.parse(jsonStr);
            return { triaged };
        } catch (e) {
            console.error("Failed to parse AI Triage JSON", text);
            // Fallback: return basic triage based on severity
            return { 
                triaged: alertsToAnalyze.map(a => ({
                    id: a.id,
                    urgency: a.severity === 'critical' ? 90 : a.severity === 'high' ? 70 : a.severity === 'medium' ? 50 : 30,
                    category: 'pending_analysis',
                    reason: 'AI analysis failed, using severity-based scoring',
                    action: a.severity === 'critical' || a.severity === 'high' ? 'investigate_now' : 'monitor'
                }))
            };
        }
    }

    static async generateDetectionRule(description: string): Promise<{ name: string, description: string, severity: string, query: string, mitreTechnique: string, runIntervalSeconds: number, explanation: string }> {
        if (!this.provider) this.initialize();

        const schemaContext = `
Table: normalized_logs
Columns:
- timestamp (DateTime)
- severity (String: critical, high, medium, low, info)
- event_type (String)
- source (String: sentinelone, crowdstrike, firewall, auth, etc.)
- tenant_id (UUID)
- host.name, host.ip (String)
- user.name (String)
- network.src_ip, network.dst_ip, network.protocol (String)
- process.name, process.path, process.command_line (String)
- file.name, file.path, file.hash (String)
`;

        const prompt = `
You are a Senior Security Detection Engineer.
Create a production-ready Detection Rule based on this request: "${description}"

**Context**:
${schemaContext}

**Instructions**:
1. **Name**: Short, professional title (e.g., "Brute Force: SSH").
2. **Description**: Concise explanation of what is detected.
3. **Severity**: "critical", "high", "medium", or "low" based on risk.
4. **Query (SQL)**: A ClickHouse WHERE clause. 
   - Use 'normalized_logs' schema. 
   - inferred thresholds (adaptive baselining) if specific numbers aren't given (e.g. > 5 attempts).
   - DO NOT include "WHERE" keyword.
5. **MITRE**: The most relevant MITRE ATT&CK Technique ID (e.g., "T1110").
6. **Interval**: Recommended run interval in seconds (default 3600, shorter for critical).

**Output JSON**:
{
  "name": "string",
  "description": "string",
  "severity": "critical"|"high"|"medium"|"low",
  "query": "string",
  "mitreTechnique": "string",
  "runIntervalSeconds": number,
  "explanation": "string"
}
`;
        const text = await this.provider.generateText(prompt);
        try {
            const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse AI Rule JSON", text);
            return {
                name: "Generated Rule",
                description: description,
                severity: "medium",
                query: "1=1",
                mitreTechnique: "",
                runIntervalSeconds: 3600,
                explanation: "Failed to generate structured rule."
            };
        }
    }
}
