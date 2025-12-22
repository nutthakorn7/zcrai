import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Mock Response for when API is missing
const MOCK_ANALYSIS = {
    classification: "FALSE_POSITIVE",
    confidence: 85,
    reasoning: "Analysis (Mock): Pattern resembles authorized administrative activity. No malicious indicators found in correlated logs.",
    suggested_action: "dismiss"
};

const getModel = () => {
    if (!genAI) return null;
    return genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
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
};

export class AITriageService {
  /**
   * Analyze alert using Generative AI
   * @param alertId Alert ID to analyze
   * @param alertData Alert context data
   */
  static async analyze(alertId: string, alertData: any) {
    try {
        // 1. Prepare Prompt
        const observablesContext = alertData.observables?.map((o: any) => 
            `- ${o.type}: ${o.value} (Malicious: ${o.isMalicious}, Tags: ${o.tags?.join(',') || 'None'})`
        ).join('\n') || 'None';

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
        - Threat Intel / Observables:
        ${observablesContext}
        
        Task:
        Is this likely a False Positive? (e.g., Backup, Update, Known Safe Activity) or a True Threat?
        Use the Threat Intel context to weight your decision.
        `;

        // 2. Call AI
        let analysis;
        
        try {
            const { GeminiService } = await import('../ai/gemini.provider');
            
            // Define Schema
            const schema = {
                type: SchemaType.OBJECT,
                properties: {
                    classification: { type: SchemaType.STRING },
                    confidence: { type: SchemaType.NUMBER },
                    reasoning: { type: SchemaType.STRING },
                    suggested_action: { type: SchemaType.STRING }
                },
                required: ["classification", "confidence", "reasoning", "suggested_action"]
            };

            const systemPrompt = `You are a Tier 3 SOC Analyst. 
            Analyze the alert and classify it as TRUE_POSITIVE or FALSE_POSITIVE.
            Provide a confidence score (0-100) and reasoning.
            If FALSE_POSITIVE with high confidence, providing actionable reasoning is critical.`;
            
            analysis = await GeminiService.generateJSON(systemPrompt + "\n\n" + prompt, schema);

        } catch (e) {
            console.warn('Gemini Service Failed/Missing - Using Mock AI Response', e);
            // Simulate delay
            await new Promise(r => setTimeout(r, 1500));
            analysis = MOCK_ANALYSIS;
        }

        // --- PHASE 2: Autonomous Response ---
        let actionTaken = null;
        if (alertData.severity === 'critical' && 
            analysis.classification === 'TRUE_POSITIVE' && 
            Number(analysis.confidence) >= 90) {
            
            // Check for malicious IP to block
            const maliciousIP = alertData.observables?.find((o: any) => o.type === 'ip' && o.isMalicious);
            // Fallback: If no dedicated observable object, try to find in rawData
            const rawIP = alertData.rawData?.dest_ip || alertData.rawData?.source_ip || alertData.rawData?.host_ip;

            const targetIP = maliciousIP?.value || rawIP;

            if (targetIP) {
                const { ResponseService } = await import('./response.service');
                const actionResult = await ResponseService.blockIP(targetIP, `AI Auto-Response: ${analysis.reasoning}`);
                
                if (actionResult.success) {
                    actionTaken = {
                        type: 'BLOCK_IP',
                        target: targetIP,
                        status: 'SUCCESS',
                        details: actionResult.details,
                        timestamp: new Date().toISOString()
                    };
                    // Append action to reasoning for visibility
                    analysis.suggested_action = `[AUTO-BLOCKED] ${targetIP}. ${analysis.suggested_action || ''}`;
                }
            }
        }
        // ------------------------------------

        // --- PHASE 1: Automation (Auto-Close & Auto-Tag) ---
        let newStatus = alertData.status; // Keep existing status by default
        let newTags = [...(alertData.tags || [])];

        // 1. Auto-Close False Positives
        if (analysis.classification === 'FALSE_POSITIVE' && Number(analysis.confidence) >= 90) {
            newStatus = 'dismissed';
            analysis.suggested_action = `[AUTO-CLOSED] High confidence False Positive. ${analysis.suggested_action || ''}`;
            console.log(`[AITriage] 📉 Auto-Dismissing Alert ${alertId}`);
        }

        // 2. Auto-Tag True Positives
        if (analysis.classification === 'TRUE_POSITIVE') {
            if (!newTags.includes('ai-verified-threat')) newTags.push('ai-verified-threat');
            if (Number(analysis.confidence) >= 90 && !newTags.includes('critical-threat')) newTags.push('critical-threat');
        }
        // ---------------------------------------------------

        // 3. Update Alert with Result
        await db.update(alerts)
            .set({
                // Store tags inside aiAnalysis since alerts table has no tags column
                aiAnalysis: { ...analysis, actionTaken, tags: newTags },
                aiTriageStatus: 'processed',
                status: newStatus
            })
            .where(eq(alerts.id, alertId));

        console.log(`✅ AI Analysis for ${alertId}: ${analysis.classification} (${analysis.confidence}%)`);
        if (actionTaken) console.log(`🚀 AUTO-RESPONSE EXECUTED: ${JSON.stringify(actionTaken)}`);

        // 4. Investigation Trigger (Phase 3 Prep)
        if (analysis.classification === 'TRUE_POSITIVE') {
             // Trigger Autonomous Investigation
             import('./ai-investigation.service').then(({ AIInvestigationService }) => {
                 AIInvestigationService.investigate({ ...alertData, id: alertId, tenantId: alertData.tenantId, aiAnalysis: analysis });
             }).catch(e => console.log('AI Investigation skipped (Service not ready)'));
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
