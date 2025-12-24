import { AIProvider, AIPlaybookSuggestion } from "../ai/types";
import { GeminiProvider } from "../ai/gemini.provider";
import { ClaudeProvider } from "../ai/claude.provider";
import { OpenAIProvider } from "../ai/openai.provider";
import { DeepseekProvider } from "../ai/deepseek.provider";

export class AIService {
    private static provider: AIProvider;

    static createProvider(providerType: string, apiKey: string): AIProvider {
        if (!apiKey) {
            throw new Error(`API key is required for ${providerType} provider`);
        }

        switch (providerType.toLowerCase()) {
            case 'gemini':
                return new GeminiProvider(apiKey);
            case 'openai':
                return new OpenAIProvider(apiKey);
            case 'claude':
                return new ClaudeProvider(apiKey);
            case 'deepseek':
                return new DeepseekProvider(apiKey);
            default:
                throw new Error(`Unsupported AI provider: ${providerType}`);
        }
    }

    static initialize() {
        // Check environment variables for AI provider configuration
        const aiProvider = process.env.AI_PROVIDER?.toLowerCase(); // 'gemini', 'openai', 'claude', 'deepseek'
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const claudeKey = process.env.CLAUDE_API_KEY;
        const deepseekKey = process.env.DEEPSEEK_API_KEY;

        // Priority: explicit AI_PROVIDER env var, then check for available keys
        if (aiProvider) {
            const keyMap: Record<string, string | undefined> = {
                'gemini': geminiKey,
                'openai': openaiKey,
                'claude': claudeKey,
                'deepseek': deepseekKey
            };

            const apiKey = keyMap[aiProvider];
            if (apiKey) {
                console.log(`[AIService] Using ${aiProvider.toUpperCase()} (from AI_PROVIDER env)`);
                this.provider = this.createProvider(aiProvider, apiKey);
                return;
            } else {
                console.warn(`[AIService] AI_PROVIDER set to '${aiProvider}' but no API key found`);
            }
        }

        // Fallback: check available keys in priority order
        if (claudeKey) {
            console.log("[AIService] Using Claude (auto-detected from CLAUDE_API_KEY)");
            this.provider = new ClaudeProvider(claudeKey);
        } else if (geminiKey) {
            console.log("[AIService] Using Google Gemini (auto-detected from GEMINI_API_KEY)");
            this.provider = new GeminiProvider(geminiKey);
        } else if (openaiKey) {
            console.log("[AIService] Using OpenAI (auto-detected from OPENAI_API_KEY)");
            this.provider = new OpenAIProvider(openaiKey);
        } else if (deepseekKey) {
            console.log("[AIService] Using Deepseek (auto-detected from DEEPSEEK_API_KEY)");
            this.provider = new DeepseekProvider(deepseekKey);
        } else {
            console.error("[AIService] No AI provider configured. Please set one of: CLAUDE_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY");
            throw new Error("AI Service Error: No AI provider API key configured. AI features will not be available.");
        }
    }

    static reload() {
        console.log("[AIService] Reloading provider...");
        this.initialize();
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
