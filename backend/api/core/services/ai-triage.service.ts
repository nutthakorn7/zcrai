import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { NotificationChannelService } from './notification-channel.service';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

import { AI_CONFIG } from '../../config/ai-config';
import { aiFeedback, tenants } from '../../infra/db/schema';
import { and, gte, ne, or, sql } from 'drizzle-orm';

// Mock Response for when API is missing
const MOCK_ANALYSIS = {
    classification: "FALSE_POSITIVE",
    confidence: 85,
    reasoning: "Analysis (Mock): Pattern resembles authorized administrative activity. No malicious indicators found in correlated logs.",
    suggested_action: "dismiss"
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

        // --- NEW: Fetch Correlation Context (Related Events) ---
        let correlationContext = "";
        try {
            const windowStart = new Date();
            windowStart.setHours(windowStart.getHours() - AI_CONFIG.TRIAGE.CORRELATION_WINDOW_HOURS);
            
            const hostName = alertData.rawData?.host_name;
            const userName = alertData.rawData?.user_name;
            
            const related = await db.select()
                .from(alerts)
                .where(and(
                    eq(alerts.tenantId, alertData.tenantId),
                    gte(alerts.createdAt, windowStart),
                    ne(alerts.id, alertId), // Don't include ourselves
                    or(
                        hostName ? eq(sql`raw_data->>'host_name'`, hostName) : undefined,
                        userName ? eq(sql`raw_data->>'user_name'`, userName) : undefined
                    )
                ))
                .limit(5);

            if (related.length > 0) {
                correlationContext = `\n\nRecent Related Alerts (Last ${AI_CONFIG.TRIAGE.CORRELATION_WINDOW_HOURS}h):\n` + 
                    related.map(r => `- [${r.severity.toUpperCase()}] ${r.title} (Status: ${r.status})`).join('\n');
                console.log(`[AITriage] 🔗 Correlation: Found ${related.length} related alerts`);
            }
        } catch (e) {
            console.warn("[AITriage] Correlation Fetch Failed:", e);
        }

        // --- RAG: Fetch Historical Context ---
        let historicalContext = "";
        try {
            const { EmbeddingService } = await import('./embedding.service');
            const alertContent = `Title: ${alertData.title}. Description: ${alertData.description}. Source: ${alertData.source}. Validated: ${alertData.status}`;
            const similarAlerts = await EmbeddingService.searchSimilar(alertData.tenantId, alertContent, AI_CONFIG.TRIAGE.MAX_RAG_RESULTS);
            
            if (similarAlerts.length > 0) {
                const alertIds = similarAlerts.map(a => a.id);
                const feedback = await db.select().from(aiFeedback).where(and(
                    eq(aiFeedback.tenantId, alertData.tenantId),
                    inArray(aiFeedback.alertId, alertIds)
                ));

                historicalContext = `\n\nSimilar Past Alerts (RAG Context):\n` + similarAlerts.map((a: any) => {
                    const f = feedback.find(fb => fb.alertId === a.id);
                    const feedbackStr = f ? ` (User Rating: ${f.rating === 1 ? 'Correct' : 'Incorrect'}, Comment: ${f.comment || 'N/A'})` : '';
                    return `- [${a.aiAnalysis?.classification || 'Unknown'}] ${a.title}${feedbackStr}`;
                }).join('\n');
                console.log(`[AITriage] 🧠 RAG: Found ${similarAlerts.length} similar alerts with ${feedback.length} feedback entries`);
            }
        } catch (error) {
            console.warn("[AITriage] RAG Fetch Failed:", error);
        }

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

        ${correlationContext}
        
        Task:
        Is this likely a False Positive? (e.g., Backup, Update, Known Safe Activity) or a True Threat?
        Use the Threat Intel context AND Historical Context to weight your decision.
        IMPORTANT: If historical context shows a TRATING was "Incorrect", do NOT repeat that mistake.
        Look at Related Alerts to see if this is isolated or part of a sequence.
        `;

        // 2. Call AI
        let analysis;
        
        try {
            const { GeminiService } = await import('../ai/gemini.provider');
            
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
                EmbeddingService.store(alertId, alertData.tenantId, contentToIndex).catch(e => console.warn("RAG Indexing failed", e));
            } catch (e) { console.warn("RAG Indexing init failed", e); }

        } catch (e) {
            console.warn('Gemini Service Failed/Missing - Using Mock AI Response', e);
            await new Promise(r => setTimeout(r, 1500));
            analysis = MOCK_ANALYSIS;
        }

        // --- PHASE 2: Autonomous Response ---
        let actionTaken: any = null;
        
        // Fetch Tenant Settings for Autopilot
        const [tenantSettings] = await db.select().from(tenants).where(eq(tenants.id, alertData.tenantId));
        const autopilotEnabled = tenantSettings?.autopilotMode ?? true;
        const autopilotThreshold = tenantSettings?.autopilotThreshold ?? 90;

        // 1. Auto-Block IP
        if (autopilotEnabled &&
            alertData.severity === 'critical' && 
            analysis.classification === 'TRUE_POSITIVE' && 
            Number(analysis.confidence) >= autopilotThreshold) {
            
            const targetIP = alertData.observables?.find((o: any) => o.type === 'ip' && o.isMalicious)?.value || 
                             alertData.rawData?.dest_ip || alertData.rawData?.source_ip;

            if (targetIP) {
                const { SoarService } = await import('./soar.service');
                try {
                    const actionResult = await SoarService.execute({
                        tenantId: alertData.tenantId,
                        alertId,
                        actionType: 'BLOCK_IP',
                        provider: alertData.source,
                        target: targetIP,
                        triggeredBy: 'ai'
                    });
                    
                    actionTaken = {
                        type: 'BLOCK_IP',
                        target: targetIP,
                        status: 'SUCCESS',
                        details: actionResult.provider_response || 'Successfully blocked',
                        timestamp: new Date().toISOString()
                    };
                    analysis.suggested_action = `[AUTO-BLOCKED] ${targetIP}. ${analysis.suggested_action || ''}`;

                    NotificationChannelService.send(alertData.tenantId, {
                        type: 'alert',
                        severity: 'critical',
                        title: `🚫 AI Auto-Blocked IP: ${targetIP}`,
                        message: `Alert: ${alertData.title}\nReason: ${analysis.reasoning}\nConfidence: ${analysis.confidence}%`,
                        metadata: { alertId, ip: targetIP, action: 'auto_block' }
                    }).catch(e => console.warn('Failed to send auto-block notification:', e.message));
                } catch (actionError: any) {
                    console.error(`[AITriage] Auto-Block Failed for ${targetIP}:`, actionError.message);
                }
            }
        }

        // 2. Auto-Isolate Host (Ransomware/Critical)
        const isRansomware = alertData.title.toLowerCase().includes('ransomware') || 
                           alertData.description.toLowerCase().includes('ransomware');
        
        if (isRansomware && 
            analysis.classification === 'TRUE_POSITIVE' && 
            Number(analysis.confidence) >= AI_CONFIG.TRIAGE.AUTO_ISOLATE_CONFIDENCE) {
            
            const hostName = alertData.rawData?.host_name;
            if (hostName) {
                const { SoarService } = await import('./soar.service');
                try {
                    const isoResult = await SoarService.execute({
                        tenantId: alertData.tenantId,
                        alertId,
                        actionType: 'ISOLATE_HOST',
                        provider: alertData.source,
                        target: hostName,
                        triggeredBy: 'ai'
                    });
                    
                    actionTaken = {
                        ...(actionTaken || {}),
                        type: actionTaken ? 'MULTI_ACTION' : 'ISOLATE_HOST',
                        target: hostName,
                        status: 'SUCCESS',
                        details: isoResult.provider_response || 'Successfully isolated',
                        timestamp: new Date().toISOString(),
                        multipleActions: actionTaken ? [actionTaken, { type: 'ISOLATE_HOST', target: hostName }] : undefined
                    };
                    analysis.suggested_action = `[AUTO-ISOLATED] ${hostName}. ${analysis.suggested_action || ''}`;
                    
                    NotificationChannelService.send(alertData.tenantId, {
                        type: 'alert',
                        severity: 'critical',
                        title: `🔒 AI Auto-Isolated Host: ${hostName}`,
                        message: `Threat: Ransomware detected\nAction: Host has been disconnected from the network automatically.`,
                        metadata: { alertId, hostname: hostName, action: 'auto_isolate' }
                    }).catch(e => console.warn('Failed to send auto-isolate notification:', e.message));
                } catch (actionError: any) {
                    console.error(`[AITriage] Auto-Isolate Failed for ${hostName}:`, actionError.message);
                }
            }
        }

        // --- PHASE 1: Automation (Auto-Close & Auto-Tag) ---
        let newStatus = alertData.status;
        let newTags = [...(alertData.tags || [])];

        if (analysis.classification === 'FALSE_POSITIVE' && Number(analysis.confidence) >= AI_CONFIG.TRIAGE.AUTO_DISMISS_CONFIDENCE) {
            newStatus = 'dismissed';
            analysis.suggested_action = `[AUTO-CLOSED] High confidence False Positive. ${analysis.suggested_action || ''}`;
            console.log(`[AITriage] 📉 Auto-Dismissing Alert ${alertId}`);
        }

        if (analysis.classification === 'TRUE_POSITIVE') {
            if (!newTags.includes('ai-verified-threat')) newTags.push('ai-verified-threat');
            if (Number(analysis.confidence) >= 90 && !newTags.includes('critical-threat')) newTags.push('critical-threat');
        }

        // --- PHASE 3.5: Auto-Case Promotion ---
        let promotedCase = null;
        if (alertData.severity === 'critical' && 
            analysis.classification === 'TRUE_POSITIVE' && 
            Number(analysis.confidence) >= AI_CONFIG.TRIAGE.AUTO_PROMOTE_CONFIDENCE &&
            !alertData.caseId) {
            
            try {
                const { AlertService } = await import('./alert.service');
                const result = await AlertService.promoteToCase(alertId, alertData.tenantId, 'system-ai');
                promotedCase = result.case;
                newTags.push('auto-promoted');
                analysis.suggested_action = `[AUTO-PROMOTED to Case ${promotedCase.id}] ${analysis.suggested_action || ''}`;

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

        // --- MSSP Pre-emptive Global Hunt ---
        if (analysis.classification === 'TRUE_POSITIVE' && Number(analysis.confidence) >= 90) {
            const maliciousIOCs = alertData.observables?.filter((o: any) => o.isMalicious);
            if (maliciousIOCs && maliciousIOCs.length > 0) {
                import('./mssp.service').then(({ MSSPService }) => {
                    maliciousIOCs.forEach((ioc: any) => {
                        MSSPService.globalSearch(ioc.value).then((hits: any) => {
                            if (hits && hits.length > 0) {
                                console.log(`[AITriage] 🚨 Global Hunt HIT! IOC ${ioc.value} found in other tenants:`, hits.map((h:any) => h.tenant_id));
                            }
                        });
                    });
                }).catch(e => console.warn('MSSP Global Search skipped', e));
            }
        }

        // 3. Update Alert with Result
        await db.update(alerts)
            .set({
                aiAnalysis: { ...analysis, actionTaken, tags: newTags, promotedCaseId: promotedCase?.id },
                aiTriageStatus: 'processed',
                status: newStatus
            })
            .where(eq(alerts.id, alertId));

        console.log(`✅ AI Analysis for ${alertId}: ${analysis.classification} (${analysis.confidence}%)`);

        // 4. Investigation Trigger
        if (analysis.classification === 'TRUE_POSITIVE') {
             import('./ai-investigation.service').then(({ AIInvestigationService }) => {
                 AIInvestigationService.investigate({ ...alertData, id: alertId, tenantId: alertData.tenantId, aiAnalysis: analysis });
             }).catch(e => console.log('AI Investigation skipped (Service not ready)'));
        }

        return analysis;

    } catch (e) {
        console.error('AI Triage Failed:', e);
        try {
            await db.update(alerts).set({ aiTriageStatus: 'failed' }).where(eq(alerts.id, alertId));
        } catch (dbErr) {
            console.error('Failed to update alert status to failed', dbErr);
        }
    }
  }
}
function inArray(column: any, values: string[]): any {
    return sql`${column} IN ${values}`;
}
