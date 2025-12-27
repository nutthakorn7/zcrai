import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';

export interface FormalReport {
  title: string;
  executiveSummary: string;
  incidentTimeline: { time: string; event: string }[];
  evidenceAnalysis: { component: string; detail: string; status: 'MALICIOUS' | 'SUSPICIOUS' | 'BENIGN' | 'UNKNOWN' }[];
  mitreMapping: { tactic: string; technique: string; description: string }[];
  verdict: {
    classification: 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'BENIGN_POSITIVE';
    confidence: number;
    reasoning: string;
  };
  recommendations: string[];
  generatedAt: string;
}

export const AIReportSynthesisService = {
  /**
   * Synthesize a formal investigation report from raw investigation logs and findings
   */
  async synthesizeFormalReport(tenantId: string, alertId: string): Promise<FormalReport> {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));

    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.tenantId !== tenantId) {
       throw new Error('Tenant mismatch');
    }

    const aiAnalysis = alert.aiAnalysis as any;
    if (!aiAnalysis || !aiAnalysis.investigationLog) {
      throw new Error('Investigation data not found. Please run investigation first.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
You are a Senior Cyber Security Incident Responder. 
Your task is to synthesize a formal, executive-ready investigation report based on raw investigation data.

Raw Investigation Data for Alert: "${alert.title}"
Description: ${alert.description}

Findings:
${JSON.stringify(aiAnalysis.swarmFindings || [], null, 2)}

Investigation Log:
${aiAnalysis.investigationLog.join('\n')}

Historical Context:
${JSON.stringify(aiAnalysis.historicalContext || [], null, 2)}

Please transform this into a structured JSON report with the following schema:
{
  "title": "Formal Security Incident Report",
  "executiveSummary": "High-level summary for management...",
  "incidentTimeline": [
    {"time": "ISO timestamp or relative time", "event": "Description of activity"}
  ],
  "evidenceAnalysis": [
    {"component": "IP/Hash/User", "detail": "Analysis of this component", "status": "MALICIOUS/SUSPICIOUS/BENIGN/UNKNOWN"}
  ],
  "mitreMapping": [
    {"tactic": "Tactic Name", "technique": "Technique ID/Name", "description": "How it applies here"}
  ],
  "verdict": {
    "classification": "TRUE_POSITIVE/FALSE_POSITIVE/BENIGN_POSITIVE",
    "confidence": 0-100,
    "reasoning": "Detailed justification for the verdict"
  },
  "recommendations": ["Action item 1", "Action item 2"]
}

Rules:
1. Be professional and technical but clear for managers.
2. Use clinical, objective language.
3. Ensure the timeline accurately reflects the investigation log steps.
4. If MITRE mappings are not obvious, infer them based on the attack patterns found.

ONLY respond with valid JSON.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      // Parse JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI failed to generate structured report');
      
      const report = JSON.parse(jsonMatch[0]);
      
      // Record Usage
      const { AICostControlService } = await import('./ai-cost-control.service');
      if (result.response.usageMetadata) {
          await AICostControlService.recordUsage(tenantId, { tokens: result.response.usageMetadata as any });
      }

      return {
        ...report,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      console.error('[ReportSynthesis] Failed:', e);
      throw new Error(`AI Synthesis failed: ${(e as Error).message}`);
    }
  }
};
