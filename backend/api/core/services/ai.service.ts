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

    static async summarizeCase(caseData: any): Promise<string> {
        if (!this.provider) this.initialize();

        const prompt = `
You are a Cyber Security Analyst AI (zcrAI).
Analyze the following Security Incident Case and provide a concise summary, key findings, and recommended actions.

**Case Details**:
- Title: ${caseData.title}
- Severity: ${caseData.severity}
- Description: ${caseData.description}
- Alert Count: ${caseData.alerts?.length || 0}

**Alerts**:
${caseData.alerts?.map((a: any) => `- [${a.severity}] ${a.title}: ${a.description}`).join('\n') || "No correlated alerts."}

**Format**: Markdown.
**Tone**: Professional, Urgent if high severity.
`;
        return this.provider.generateText(prompt);
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
}
