import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { db } from '../../infra/db';
import { playbooks, alerts } from '../../infra/db/schema';
import { eq, and } from 'drizzle-orm';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export class AIPlaybookService {
    
    /**
     * Suggest relevant playbooks for a given alert
     * @param tenantId Tenant ID
     * @param alertId Alert ID to analyze
     */
    static async suggest(tenantId: string, alertId: string) {
        if (!genAI) {
            return {
                suggestions: [],
                message: "AI not configured"
            };
        }

        // 1. Fetch Alert Context
        const [alert] = await db
            .select()
            .from(alerts)
            .where(and(eq(alerts.id, alertId), eq(alerts.tenantId, tenantId)));

        if (!alert) throw new Error("Alert not found");

        // 2. Fetch Active Playbooks
        const activePlaybooks = await db
            .select({
                id: playbooks.id,
                title: playbooks.title,
                description: playbooks.description,
                targetTag: playbooks.targetTag
            })
            .from(playbooks)
            .where(eq(playbooks.tenantId, tenantId)); // Filter by active later if column exists

        if (activePlaybooks.length === 0) {
            return {
                suggestions: [],
                message: "No playbooks available"
            };
        }

        // 3. Rate Limit
        const { RateLimitService } = await import('./rate-limit.service');
        await RateLimitService.consume('gemini', 1);

        // 4. Call AI
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        suggestions: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    playbookId: { type: SchemaType.STRING },
                                    matchScore: { type: SchemaType.NUMBER },
                                    reasoning: { type: SchemaType.STRING }
                                },
                                required: ["playbookId", "matchScore", "reasoning"]
                            }
                        }
                    },
                    required: ["suggestions"]
                }
            }
        });

        const prompt = `
        You are a SOC Automation Architect.
        Suggest the most relevant Playbooks for this Alert.
        
        Alert Context:
        - Title: ${alert.title}
        - Description: ${alert.description}
        - Source: ${alert.source}
        - Severity: ${alert.severity}
        
        Available Playbooks:
        ${JSON.stringify(activePlaybooks)}
        
        Task:
        1. Analyze if any playbook matches the alert's intent.
        2. Assign a match score (0-100).
        3. Explain why (reasoning).
        4. Return top 3 matches. If none are relevant, return empty list.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response.text();
            const parsed = JSON.parse(response);
            
            // Enrich with Playbook Titles
            const enrichedSuggestions = parsed.suggestions.map((s: any) => {
                const pb = activePlaybooks.find(p => p.id === s.playbookId);
                return {
                    ...s,
                    title: pb?.title || 'Unknown Playbook'
                };
            }).filter((s: any) => s.matchScore > 50).sort((a: any, b: any) => b.matchScore - a.matchScore);

            return {
                suggestions: enrichedSuggestions,
                message: "Success"
            };

        } catch (error) {
            console.error('[AIPlaybook] Suggestion failed:', error);
            return {
                suggestions: [],
                message: "AI processing failed"
            };
        }
    }
}
