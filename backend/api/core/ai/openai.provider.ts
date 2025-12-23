import OpenAI from "openai";
import { AIProvider } from "./types";

export class OpenAIProvider implements AIProvider {
    name = "openai";
    private client: OpenAI;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("OpenAI API key is required");
        }
        this.client = new OpenAI({ apiKey });
    }

    async generateText(prompt: string): Promise<string> {
        try {
            const response = await this.client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 4096
            });
            return response.choices[0]?.message?.content || "";
        } catch (e: any) {
            console.error("OpenAI API Error:", e);
            throw new Error(`OpenAI Analysis Failed: ${e.message}`);
        }
    }
}
