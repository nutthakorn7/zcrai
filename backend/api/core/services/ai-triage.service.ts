import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { NotificationChannelService } from './notification-channel.service';

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

        // --- RAG: Fetch Historical Context ---
        let historicalContext = "";
        try {
            const { EmbeddingService } = await import('./embedding.service');
            const alertContent = `Title: ${alertData.title}. Description: ${alertData.description}. Source: ${alertData.source}. Validated: ${alertData.status}`;
            const similarAlerts = await EmbeddingService.searchSimilar(alertData.tenantId, alertContent, 3);
            
            if (similarAlerts.length > 0) {
                historicalContext = `\n\nSimilar Past Alerts (RAG Context):\n` + similarAlerts.map((a: any) => 
                    `- [${a.aiAnalysis?.classification || 'Unknown'}] ${a.title} (Action: ${a.aiAnalysis?.suggested_action || 'None'})`
                ).join('\n');
                console.log(`[AITriage] 🧠 RAG: Found ${similarAlerts.length} similar alerts`);
            }
        } catch (error) {
            console.warn("[AITriage] RAG Fetch Failed:", error);
        }
        // -------------------------------------

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

        ${historicalContext}
        
        Task:
        Is this likely a False Positive? (e.g., Backup, Update, Known Safe Activity) or a True Threat?
        Use the Threat Intel context AND Historical Context to weight your decision.
        `;

        // 2. Call AI
        let analysis;
        
        try {
            // Apply Rate Limiting
            const { RateLimitService } = await import('./rate-limit.service');
            await RateLimitService.consume('gemini', 1);

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
            If FALSE_POSITIVE with high confidence, providing actionable reasoning is critical.
            Use provided Historical Context (RAG) to consistency.`;
            
            analysis = await GeminiService.generateJSON(systemPrompt + "\n\n" + prompt, schema);

            // --- RAG: Index this analysis for future ---
            try {
                const { EmbeddingService } = await import('./embedding.service');
                const contentToIndex = `Title: ${alertData.title}. Description: ${alertData.description}. Source: ${alertData.source}. Verdict: ${analysis.classification}. Reasoning: ${analysis.reasoning}`;
                // Fire and forget indexing
                EmbeddingService.store(alertId, alertData.tenantId, contentToIndex).catch(e => console.warn("RAG Indexing failed", e));
            } catch (e) { console.warn("RAG Indexing init failed", e); }
            // ------------------------------------------

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

                    // 🔔 Send notification to LINE/Slack/Teams
                    NotificationChannelService.send(alertData.tenantId, {
                        type: 'alert',
                        severity: 'critical',
                        title: `🚫 AI Auto-Blocked IP: ${targetIP}`,
                        message: `Alert: ${alertData.title}\nReason: ${analysis.reasoning}\nConfidence: ${analysis.confidence}%`,
                        metadata: { alertId, ip: targetIP, action: 'auto_block' }
                    }).catch(e => console.warn('Failed to send auto-block notification:', e.message));
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

        // --- PHASE 3.5: Auto-Case Promotion ---
        let promotedCase = null;
        if (alertData.severity === 'critical' && 
            analysis.classification === 'TRUE_POSITIVE' && 
            Number(analysis.confidence) >= 85 &&
            !alertData.caseId) {  // Only if not already linked to a case
            
            try {
                const { AlertService } = await import('./alert.service');
                const result = await AlertService.promoteToCase(
                    alertId, 
                    alertData.tenantId, 
                    'system-ai'  // System user for AI actions
                );
                promotedCase = result.case;
                newTags.push('auto-promoted');
                analysis.suggested_action = `[AUTO-PROMOTED to Case ${promotedCase.id}] ${analysis.suggested_action || ''}`;
                console.log(`[AITriage] 📋 Auto-Promoted Alert ${alertId} to Case ${promotedCase.id}`);

                // 🔔 Send notification to LINE/Slack/Teams
                NotificationChannelService.send(alertData.tenantId, {
                    type: 'alert',
                    severity: 'critical',
                    title: `📋 AI Auto-Created Case from Critical Alert`,
                    message: `Alert: ${alertData.title}\nCase ID: ${promotedCase.id}\nClassification: TRUE_POSITIVE (${analysis.confidence}%)`,
                    metadata: { alertId, caseId: promotedCase.id, action: 'auto_promote' }
                }).catch(e => console.warn('Failed to send auto-promote notification:', e.message));

            } catch (e: any) {
                console.warn(`[AITriage] Failed to auto-promote alert ${alertId}:`, e.message);
            }
        }
        // ---------------------------------------

        // 3. Update Alert with Result
        await db.update(alerts)
            .set({
                // Store tags inside aiAnalysis since alerts table has no tags column
                aiAnalysis: { ...analysis, actionTaken, tags: newTags, promotedCaseId: promotedCase?.id },
                aiTriageStatus: 'processed',
                status: newStatus
            })
            .where(eq(alerts.id, alertId));

        console.log(`✅ AI Analysis for ${alertId}: ${analysis.classification} (${analysis.confidence}%)`);
        if (actionTaken) console.log(`🚀 AUTO-RESPONSE EXECUTED: ${JSON.stringify(actionTaken)}`);
        if (promotedCase) console.log(`📋 AUTO-PROMOTED to Case: ${promotedCase.id}`);

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
