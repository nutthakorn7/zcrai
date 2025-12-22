import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider } from "./types";

export class GeminiProvider implements AIProvider {
    name = "gemini";
    private client: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey?: string) {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (key) {
             this.client = new GoogleGenerativeAI(key);
             this.model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });
        } else {
            console.warn("GeminiProvider initialized without API Key. Analysis will fail if used.");
        }
    }

    async generateText(prompt: string): Promise<string> {
        if (!this.model) throw new Error("GEMINI_API_KEY is not set");
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e: any) {
            console.error("Gemini API Error:", e);
            throw new Error(`Gemini Analysis Failed: ${e.message}`);
        }
    }

    async generateJSON(prompt: string, schema?: any): Promise<any> {
        if (!this.client) throw new Error("GEMINI_API_KEY is not set");
        try {
            const config: any = { responseMimeType: "application/json" };
            if (schema) config.responseSchema = schema;

            const model = this.client.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                generationConfig: config
            });

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            return JSON.parse(text);
        } catch (e: any) {
             console.error("Gemini JSON Error:", e);
             throw new Error(`Gemini JSON Failed: ${e.message}`);
        }
    }
}

export const GeminiService = new GeminiProvider();
