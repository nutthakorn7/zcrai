import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider } from "./types";

export class GeminiProvider implements AIProvider {
    name = "gemini";
    private client: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    async generateText(prompt: string): Promise<string> {
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e: any) {
            console.error("Gemini API Error:", e);
            throw new Error(`Gemini Analysis Failed: ${e.message}`);
        }
    }
}
