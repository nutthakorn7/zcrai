import OpenAI from "openai";
import { AIProvider } from "./types";

export class DeepseekProvider implements AIProvider {
    name = "deepseek";
    private client: OpenAI;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Deepseek API key is required");
        }
        // Deepseek uses OpenAI-compatible API
        this.client = new OpenAI({
            apiKey,
            baseURL: "https://api.deepseek.com/v1"
        });
    }

    async generateText(prompt: string): Promise<string> {
        try {
            const response = await this.client.chat.completions.create({
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 4096
            });
            return response.choices[0]?.message?.content || "";
        } catch (e: any) {
            console.error("Deepseek API Error:", e);
            throw new Error(`Deepseek Analysis Failed: ${e.message}`);
        }
    }
}
