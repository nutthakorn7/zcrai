import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Use Flash for speed
    systemInstruction: `You are a Tier 3 SOC Analyst. 
    Analyze the alert and classify it as TRUE_POSITIVE or FALSE_POSITIVE.
    Provide a confidence score (0-100) and reasoning.
    If FALSE_POSITIVE with high confidence, providing actionable reasoning is critical.
    
    Output JSON format:
    {
        "classification": "FALSE_POSITIVE" | "TRUE_POSITIVE",
        "confidence": number,
        "reasoning": string,
        "suggested_action": string
    }`,
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
                classification: { type: SchemaType.STRING },
                confidence: { type: SchemaType.NUMBER },
                reasoning: { type: SchemaType.STRING },
                suggested_action: { type: SchemaType.STRING }
            },
            required: ["classification", "confidence", "reasoning", "suggested_action"]
        }
    }
});

export class AITriageService {
  /**
   * Analyze alert using Generative AI
   * @param alertId Alert ID to analyze
   * @param alertData Alert context data
   */
  static async analyze(alertId: string, alertData: any) {
    try {
        // 1. Prepare Prompt
        const prompt = `
        Start Analysis for Alert:
        - Title: ${alertData.title}
        - Description: ${alertData.description}
        - Source: ${alertData.source}
        - User: ${alertData.rawData?.user_name || 'N/A'}
        - Host: ${alertData.rawData?.host_name || 'N/A'}
        - Event Type: ${alertData.rawData?.event_type || 'N/A'}
        - IP: ${alertData.rawData?.host_ip || 'N/A'}
        - Process: ${alertData.rawData?.process_name || 'N/A'}
        
        Context:
        - Severity: ${alertData.severity}
        
        Task:
        Is this likely a False Positive? (e.g., Backup, Update, Known Safe Activity) or a True Threat?
        `;

        // 2. Call AI
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const analysis = JSON.parse(text);

        // 3. Update Alert
        await db.update(alerts)
            .set({
                aiAnalysis: analysis,
                aiTriageStatus: 'processed'
            })
            .where(eq(alerts.id, alertId));

        // 4. Autonomous Action
        if (analysis.classification === 'FALSE_POSITIVE' && analysis.confidence > 90) {
             // Auto-Close Logic
             const autoComment = `⛔️ **Auto-Closed by AI**\n\n**Reasoning:** ${analysis.reasoning}\n**Confidence:** ${analysis.confidence}%`;
             
             await db.update(alerts)
                .set({
                    status: 'dismissed',
                    updatedAt: new Date()
                })
                .where(eq(alerts.id, alertId));
        } else if (analysis.classification === 'TRUE_POSITIVE') {
             // Trigger Autonomous Investigation
             import('./ai-investigation.service').then(({ AIInvestigationService }) => {
                 AIInvestigationService.investigate({ ...alertData, id: alertId, tenantId: alertData.tenantId, aiAnalysis: analysis });
             });
        }

        return analysis;

    } catch (e) {
        console.error('AI Triage Failed:', e);
        await db.update(alerts)
            .set({ aiTriageStatus: 'failed' })
            .where(eq(alerts.id, alertId));
    }
  }
}
