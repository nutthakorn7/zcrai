import Anthropic from "@anthropic-ai/sdk";
import { AIProvider } from "./types";

export class ClaudeProvider implements AIProvider {
    name = "claude";
    private client: Anthropic;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Claude API key is required");
        }
        this.client = new Anthropic({ apiKey });
    }

    async generateText(prompt: string): Promise<string> {
        try {
            const response = await this.client.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 4096,
                messages: [{ role: "user", content: prompt }]
            });
            const content = response.content[0];
            return content?.type === 'text' ? content.text : '';
        } catch (e: any) {
            console.error("Claude API Error:", e);
            throw new Error(`Claude Analysis Failed: ${e.message}`);
        }
    }
}
