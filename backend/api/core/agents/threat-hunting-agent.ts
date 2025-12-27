/**
 * Threat Hunting Agent
 * Proactively searches for threats using AI-generated hypotheses
 */

import { BaseAgent, AgentTask, AgentResult } from './base-agent';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts, cases } from '../../infra/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

// Hunting Hypothesis
export interface HuntingHypothesis {
  id: string;
  title: string;
  description: string;
  mitreTactic?: string;
  mitreTechnique?: string;
  indicators: string[];
  logQueries: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'hunting' | 'found_threat' | 'no_threat' | 'error';
  createdAt: Date;
  results?: HuntingResult[];
}

// Hunting Result
export interface HuntingResult {
  hypothesis: string;
  findings: any[];
  threatFound: boolean;
  confidence: number;
  summary: string;
  recommendations: string[];
}

export class ThreatHuntingAgent extends BaseAgent {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    super('ThreatHunter');
  }

  private getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  async process(task: AgentTask): Promise<AgentResult> {
    this.log(`Received task: ${task.type}`);

    try {
      switch (task.type) {
        case 'generate_hypotheses':
          return await this.generateHypotheses(task.params.tenantId, task.params.context);
        case 'execute_hunt':
          return await this.executeHunt(task.params.tenantId, task.params.hypothesis);
        case 'autonomous_hunt':
          return await this.autonomousHunt(task.params.tenantId);
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error: any) {
      return {
        agent: this.name,
        status: 'failed',
        error: error.message,
        summary: `Threat hunting failed: ${error.message}`
      };
    }
  }

  /**
   * Generate hunting hypotheses based on recent alerts and threat intelligence
   */
  async generateHypotheses(tenantId: string, context?: string): Promise<AgentResult> {
    this.log('Generating hunting hypotheses...');

    try {
      // Get recent alerts for context
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentAlerts = await db.query.alerts.findMany({
        where: and(
          eq(alerts.tenantId, tenantId),
          gte(alerts.createdAt, thirtyDaysAgo)
        ),
        orderBy: [desc(alerts.createdAt)],
        limit: 20
      });

      const alertContext = recentAlerts
        .map(a => `- ${a.title} (${a.severity}): ${a.description?.substring(0, 100)}`)
        .join('\n');

      const genAI = this.getGenAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `You are a Threat Hunter AI. Based on the recent security alerts and context, generate hunting hypotheses.

Recent Alerts in Environment:
${alertContext || 'No recent alerts'}

Additional Context: ${context || 'None'}

Generate 3-5 hunting hypotheses that:
1. Target threats that may be hiding in the environment
2. Focus on MITRE ATT&CK techniques
3. Include specific log queries or indicators to search for

Respond with JSON array:
[
  {
    "title": "Hunt for Lateral Movement via RDP",
    "description": "Search for unusual RDP connections between internal hosts",
    "mitreTactic": "Lateral Movement",
    "mitreTechnique": "T1021.001",
    "indicators": ["tcp/3389", "internal-to-internal RDP"],
    "logQueries": ["dest_port = 3389 AND src_ip LIKE '10.%' AND dest_ip LIKE '10.%'"],
    "priority": "high"
  }
]

ONLY respond with valid JSON array.`;

      const result = await model.generateContent(prompt);

      // Record Usage
      try {
        const { AICostControlService } = await import('../services/ai-cost-control.service');
        if (result.response.usageMetadata) {
          await AICostControlService.recordUsage(tenantId, { tokens: result.response.usageMetadata as any });
        }
      } catch (e) {
        this.log(`Usage recording failed: ${(e as Error).message}`);
      }

      const responseText = result.response.text().trim();

      // Parse JSON
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return {
          agent: this.name,
          status: 'failed',
          error: 'Failed to parse hypotheses',
          summary: 'Could not generate hunting hypotheses'
        };
      }

      const hypotheses: HuntingHypothesis[] = JSON.parse(jsonMatch[0]).map((h: any) => ({
        id: `hyp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...h,
        status: 'pending',
        createdAt: new Date()
      }));

      this.log(`Generated ${hypotheses.length} hunting hypotheses`);

      return {
        agent: this.name,
        status: 'success',
        data: { hypotheses },
        summary: `Generated ${hypotheses.length} hunting hypotheses targeting ${hypotheses.map(h => h.mitreTactic).filter(Boolean).join(', ')}`
      };
    } catch (e) {
      return {
        agent: this.name,
        status: 'failed',
        error: (e as Error).message,
        summary: 'Failed to generate hypotheses'
      };
    }
  }

  /**
   * Execute a specific hunting hypothesis
   */
  async executeHunt(tenantId: string, hypothesis: HuntingHypothesis): Promise<AgentResult> {
    this.log(`Executing hunt: ${hypothesis.title}`);

    try {
      // Import ClickHouse client for log analysis
      const { query: chClientQuery } = await import('../../infra/clickhouse/client');

      const findings: any[] = [];
      let threatFound = false;

      // Execute each log query
      for (const queryStr of hypothesis.logQueries || []) {
        try {
          // Build ClickHouse query
          const chQuery = `
            SELECT *
            FROM security_logs
            WHERE tenant_id = '${tenantId}'
              AND ${queryStr}
            ORDER BY timestamp DESC
            LIMIT 100
          `;

          const rows = await chClientQuery<any>(chQuery, { tenantId });
          
          if (rows.length > 0) {
            findings.push({
              query: queryStr,
              matchCount: rows.length,
              samples: rows.slice(0, 5)
            });
            threatFound = true;
          }
        } catch (queryError) {
          this.log(`Query failed: ${(queryError as Error).message}`);
        }
      }

      // Analyze findings with AI
      let analysis = '';
      let recommendations: string[] = [];

      if (findings.length > 0) {
        const genAI = this.getGenAI();
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const analysisPrompt = `Analyze these threat hunting findings:

Hypothesis: ${hypothesis.title}
Description: ${hypothesis.description}
MITRE: ${hypothesis.mitreTactic} / ${hypothesis.mitreTechnique}

Findings:
${JSON.stringify(findings, null, 2)}

Provide:
1. Brief analysis (2-3 sentences)
2. Is this a true threat? (confidence 0-100%)
3. 2-3 recommended actions

Respond in JSON:
{
  "analysis": "...",
  "isThreat": true/false,
  "confidence": 85,
  "recommendations": ["...", "..."]
}`;

        const analysisResult = await model.generateContent(analysisPrompt);

        // Record Usage
        try {
          const { AICostControlService } = await import('../services/ai-cost-control.service');
          if (analysisResult.response.usageMetadata) {
            await AICostControlService.recordUsage(tenantId, { tokens: analysisResult.response.usageMetadata as any });
          }
        } catch (e) {
          this.log(`Usage recording failed: ${(e as Error).message}`);
        }

        const analysisText = analysisResult.response.text();
        
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          analysis = parsed.analysis;
          threatFound = parsed.isThreat;
          recommendations = parsed.recommendations || [];
        }
      }

      const huntResult: HuntingResult = {
        hypothesis: hypothesis.title,
        findings,
        threatFound,
        confidence: findings.length > 0 ? 75 : 0,
        summary: threatFound 
          ? `🚨 Potential threat found: ${analysis}`
          : `✅ No threats detected for this hypothesis`,
        recommendations
      };

      return {
        agent: this.name,
        status: 'success',
        data: huntResult,
        summary: huntResult.summary
      };
    } catch (e) {
      return {
        agent: this.name,
        status: 'failed',
        error: (e as Error).message,
        summary: `Hunt execution failed: ${(e as Error).message}`
      };
    }
  }

  /**
   * Run autonomous threat hunting session
   */
  async autonomousHunt(tenantId: string): Promise<AgentResult> {
    this.log('Starting autonomous threat hunt...');

    const results: HuntingResult[] = [];
    const threatsFound: string[] = [];

    // Step 1: Generate hypotheses
    const hypothesesResult = await this.generateHypotheses(tenantId);
    
    if (hypothesesResult.status !== 'success' || !hypothesesResult.data?.hypotheses) {
      return {
        agent: this.name,
        status: 'failed',
        error: 'Failed to generate hypotheses',
        summary: 'Autonomous hunt failed at hypothesis generation'
      };
    }

    const hypotheses = hypothesesResult.data.hypotheses as HuntingHypothesis[];
    this.log(`Generated ${hypotheses.length} hypotheses, executing hunts...`);

    // Step 2: Execute each hypothesis
    for (const hypothesis of hypotheses) {
      try {
        const huntResult = await this.executeHunt(tenantId, hypothesis);
        
        if (huntResult.status === 'success' && huntResult.data) {
          results.push(huntResult.data as HuntingResult);
          
          if ((huntResult.data as HuntingResult).threatFound) {
            threatsFound.push(hypothesis.title);
          }
        }
      } catch (e) {
        this.log(`Hunt failed for hypothesis: ${hypothesis.title}`);
      }
    }

    const summary = threatsFound.length > 0
      ? `🚨 Autonomous hunt complete: Found ${threatsFound.length} potential threats: ${threatsFound.join(', ')}`
      : `✅ Autonomous hunt complete: No threats detected across ${hypotheses.length} hypotheses`;

    return {
      agent: this.name,
      status: 'success',
      data: {
        hypothesesGenerated: hypotheses.length,
        huntsExecuted: results.length,
        threatsFound: threatsFound.length,
        results
      },
      summary
    };
  }
}
