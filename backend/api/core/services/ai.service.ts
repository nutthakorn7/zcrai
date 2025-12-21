import { AIProvider, AIPlaybookSuggestion } from "../ai/types";
import { MockAIProvider } from "../ai/mock.provider";
import { GeminiProvider } from "../ai/gemini.provider";

export class AIService {
    private static provider: AIProvider;

    static initialize() {
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;

        if (geminiKey) {
            console.log("[AIService] Using Google Gemini");
            this.provider = new GeminiProvider(geminiKey);
        } else if (process.env.NODE_ENV === 'test') {
             // In test, always mock unless integration test?
             // Actually, for simplicity, use Mock if no key.
             console.log("[AIService] Using Mock Provider (Test/No Key)");
             this.provider = new MockAIProvider();
        } else {
            console.log("[AIService] No API Key found, using Mock Provider");
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
1. Analyze the indicators (IPs, domains, hashes) and behavior.
2. Determine a **Verdict**: "True Positive", "False Positive", or "Suspicious" (if unsure).
3. Assign a **Confidence Score** (0-100).
4. Provide a **Summary** of the incident.
5. Provide a detailed **Evidence Analysis** (bullet points).

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
}
