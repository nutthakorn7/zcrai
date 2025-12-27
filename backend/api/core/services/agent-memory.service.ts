/**
 * Agent Memory Service
 * Enables AI agents to learn from past investigations and recall similar patterns
 */

import { db } from '../../infra/db';
import { alertEmbeddings, alerts, cases } from '../../infra/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { EmbeddingService } from './embedding.service';

// Memory Entry Structure
interface MemoryEntry {
  id: string;
  type: 'investigation' | 'pattern' | 'lesson';
  content: string;
  metadata: {
    alertId?: string;
    caseId?: string;
    verdict?: string;
    severity?: string;
    tactics?: string[];
    techniques?: string[];
  };
  embedding?: number[];
  createdAt: Date;
}

// Pattern Recognition Result
interface PatternMatch {
  entry: MemoryEntry;
  similarity: number;
  relevance: string;
}

export class AgentMemoryService {
  
  /**
   * Store a learned pattern from completed investigation
   */
  static async storePattern(tenantId: string, pattern: {
    description: string;
    alertTitle: string;
    alertId: string;
    verdict: 'true_positive' | 'false_positive' | 'benign';
    keyIndicators: string[];
    mitreTactics?: string[];
    mitreTechniques?: string[];
    resolution?: string;
  }): Promise<void> {
    try {
      // Build comprehensive memory content
      const memoryContent = [
        `Pattern: ${pattern.description}`,
        `Alert: ${pattern.alertTitle}`,
        `Verdict: ${pattern.verdict}`,
        `Key Indicators: ${pattern.keyIndicators.join(', ')}`,
        pattern.mitreTactics ? `MITRE Tactics: ${pattern.mitreTactics.join(', ')}` : '',
        pattern.mitreTechniques ? `MITRE Techniques: ${pattern.mitreTechniques.join(', ')}` : '',
        pattern.resolution ? `Resolution: ${pattern.resolution}` : ''
      ].filter(Boolean).join('\n');

      // Store as embedding
      await EmbeddingService.store(pattern.alertId, tenantId, memoryContent);
      
      console.log(`[Memory] Stored pattern for alert ${pattern.alertId}`);
    } catch (e) {
      console.error(`[Memory] Failed to store pattern: ${(e as Error).message}`);
    }
  }

  /**
   * Recall similar patterns from memory for a new alert
   */
  static async recallPatterns(tenantId: string, alertContext: {
    title: string;
    description: string;
    indicators?: string[];
    severity?: string;
  }, limit: number = 5): Promise<PatternMatch[]> {
    try {
      // Build query from alert context
      const queryText = [
        alertContext.title,
        alertContext.description,
        alertContext.indicators?.join(' ') || '',
        alertContext.severity ? `Severity: ${alertContext.severity}` : ''
      ].filter(Boolean).join(' ');

      // Search for similar patterns using vector search
      const similarAlerts = await EmbeddingService.searchSimilar(tenantId, queryText, limit);

      // Convert to PatternMatch format with enriched data
      const patterns: PatternMatch[] = [];
      
      for (const alert of similarAlerts) {
        const aiAnalysis = alert.aiAnalysis as any;
        
        patterns.push({
          entry: {
            id: alert.id,
            type: 'investigation',
            content: `${alert.title}: ${alert.description}`,
            metadata: {
              alertId: alert.id,
              verdict: aiAnalysis?.verdict || alert.status,
              severity: alert.severity
            },
            createdAt: alert.createdAt
          },
          similarity: 0.85, // Placeholder - actual similarity from vector search
          relevance: this.determineRelevance(alert, alertContext)
        });
      }

      console.log(`[Memory] Recalled ${patterns.length} similar patterns`);
      return patterns;
    } catch (e) {
      console.error(`[Memory] Failed to recall patterns: ${(e as Error).message}`);
      return [];
    }
  }

  /**
   * Learn from a completed investigation
   */
  static async learnFromInvestigation(tenantId: string, alertId: string): Promise<void> {
    try {
      // Fetch completed investigation data
      const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));
      
      if (!alert) {
        console.warn(`[Memory] Alert ${alertId} not found`);
        return;
      }

      const aiAnalysis = alert.aiAnalysis as any;
      
      if (!aiAnalysis?.investigationReport) {
        console.warn(`[Memory] Alert ${alertId} has no investigation report`);
        return;
      }

      // Extract key learnings from the investigation
      const learnings = [
        `Investigation: ${alert.title}`,
        `Report: ${aiAnalysis.investigationReport}`,
        `Findings: ${(aiAnalysis.swarmFindings || []).map((f: any) => f.summary).join('; ')}`,
        `Rounds: ${aiAnalysis.investigationRounds || 1}`,
        `Status: ${aiAnalysis.investigationStatus}`
      ].join('\n');

      // Store as memory pattern
      await this.storePattern(tenantId, {
        description: `Completed investigation of ${alert.title}`,
        alertTitle: alert.title,
        alertId: alertId,
        verdict: this.extractVerdict(aiAnalysis.investigationReport),
        keyIndicators: this.extractIndicators(alert),
        resolution: aiAnalysis.investigationStatus
      });

      console.log(`[Memory] Learned from investigation ${alertId}`);
    } catch (e) {
      console.error(`[Memory] Failed to learn from investigation: ${(e as Error).message}`);
    }
  }

  /**
   * Get memory statistics for a tenant
   */
  static async getMemoryStats(tenantId: string): Promise<{
    totalPatterns: number;
    recentLearnings: number;
    topPatternTypes: { type: string; count: number }[];
  }> {
    try {
      const embeddings = await db.select()
        .from(alertEmbeddings)
        .where(eq(alertEmbeddings.tenantId, tenantId));

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentLearnings = embeddings.filter(e => 
        e.createdAt && new Date(e.createdAt) > thirtyDaysAgo
      ).length;

      return {
        totalPatterns: embeddings.length,
        recentLearnings,
        topPatternTypes: [
          { type: 'investigation', count: embeddings.length }
        ]
      };
    } catch (e) {
      console.error(`[Memory] Failed to get stats: ${(e as Error).message}`);
      return { totalPatterns: 0, recentLearnings: 0, topPatternTypes: [] };
    }
  }

  // ==================== Private Helpers ====================

  private static determineRelevance(pastAlert: any, currentContext: any): string {
    // Simple relevance scoring based on severity and title similarity
    const sameSeverity = pastAlert.severity === currentContext.severity;
    const titleOverlap = pastAlert.title.toLowerCase().split(' ')
      .filter((word: string) => currentContext.title.toLowerCase().includes(word)).length;
    
    if (sameSeverity && titleOverlap > 2) return 'high';
    if (sameSeverity || titleOverlap > 1) return 'medium';
    return 'low';
  }

  private static extractVerdict(report: string): 'true_positive' | 'false_positive' | 'benign' {
    const lowerReport = report.toLowerCase();
    if (lowerReport.includes('true positive') || lowerReport.includes('malicious')) {
      return 'true_positive';
    }
    if (lowerReport.includes('false positive') || lowerReport.includes('benign')) {
      return 'false_positive';
    }
    return 'benign';
  }

  private static extractIndicators(alert: any): string[] {
    const indicators: string[] = [];
    
    // Extract from observables
    if (alert.observables) {
      for (const obs of alert.observables) {
        indicators.push(`${obs.type}:${obs.value}`);
      }
    }
    
    // Extract from rawData
    const rawData = alert.rawData as any;
    if (rawData) {
      if (rawData.source_ip) indicators.push(`ip:${rawData.source_ip}`);
      if (rawData.dest_ip) indicators.push(`ip:${rawData.dest_ip}`);
      if (rawData.user_name) indicators.push(`user:${rawData.user_name}`);
      if (rawData.file_hash) indicators.push(`hash:${rawData.file_hash}`);
    }
    
    return indicators;
  }
}
