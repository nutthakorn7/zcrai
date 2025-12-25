import { db } from '../infra/db';
import { alerts, cases } from '../infra/db/schema';
import { sql, eq, and, gte, lte, desc } from 'drizzle-orm';
import { query } from '../infra/clickhouse/client';

export interface SankeyNode {
  name: string;
  category?: string;
}

export interface SankeyLink {
  source: number; // Index of the source node
  target: number; // Index of the target node
  value: number;
}

export class AnalyticsService {
  /**
   * Categorize alert based on source and alert type
   */
  private categorizeAlert(alert: any): string {
    const source = (alert.source || '').toLowerCase();
    const title = (alert.title || '').toLowerCase();
    const description = (alert.description || '').toLowerCase();

    // Source-based categorization (highest priority)
    // EDR sources
    if (source.includes('sentinelone') || source.includes('crowdstrike')) {
      return 'EDR';
    }
    
    // Identity sources
    if (source.includes('simulate') || source.includes('simulation')) {
      return 'Identity';
    }

    const combined = `${source} ${title} ${description}`;

    // Identity-related keywords
    if (combined.includes('identity') || 
        combined.includes('user') || 
        combined.includes('authentication') ||
        combined.includes('login') ||
        combined.includes('credential') ||
        combined.includes('azure ad') ||
        combined.includes('active directory')) {
      return 'Identity';
    }

    // Email-related
    if (combined.includes('email') || 
        combined.includes('phishing') || 
        combined.includes('spam') ||
        combined.includes('mailbox') ||
        combined.includes('exchange') ||
        combined.includes('outlook')) {
      return 'Email';
    }

    // Cloud-related
    if (combined.includes('cloud') || 
        combined.includes('azure') || 
        combined.includes('aws') ||
        combined.includes('gcp') ||
        combined.includes('s3') ||
        combined.includes('storage') ||
        combined.includes('cloudtrail')) {
      return 'Cloud';
    }

    // EDR-related (Endpoint Detection & Response)
    if (combined.includes('endpoint') || 
        combined.includes('defender') || 
        combined.includes('sentinel') ||
        combined.includes('crowdstrike') ||
        combined.includes('process') ||
        combined.includes('malware') ||
        combined.includes('file') ||
        combined.includes('registry')) {
      return 'EDR';
    }

    // Default fallback
    return 'EDR';
  }

  /**
   * Get log counts from ClickHouse by source
   */
  private async getLogCountsBySource(tenantId: string, startDate: Date): Promise<Record<string, number>> {
    const startDateStr = startDate.toISOString().replace('T', ' ').replace('Z', '');
    
    const result = await query<{ source: string; count: string }>(`
      SELECT source, count() as count
      FROM security_events
      WHERE tenant_id = {tenantId:String}
        AND timestamp >= {startDate:DateTime64}
      GROUP BY source
      ORDER BY count DESC
    `, { tenantId, startDate: startDateStr });
    
    const breakdown: Record<string, number> = {};
    for (const row of result) {
      breakdown[row.source || 'Unknown Source'] = parseInt(row.count);
    }
    return breakdown;
  }

  /**
   * Generates aggregated data for the Enterprise Insights Sankey Diagram
   */
  async getInsightsData(tenantId: string, days: number): Promise<{ 
    nodes: SankeyNode[], 
    links: SankeyLink[], 
    stats: any 
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch log counts from ClickHouse for Ingestion stage
    const logCountsBySource = await this.getLogCountsBySource(tenantId, startDate);
    const totalLogs = Object.values(logCountsBySource).reduce((sum, c) => sum + c, 0);

    // Fetch alerts with their related case status
    const alertsData = await db.query.alerts.findMany({
      where: and(
        eq(alerts.tenantId, tenantId),
        gte(alerts.createdAt, startDate)
      ),
      with: {
        case: true
      }
    });

    // Node & Link Management
    const nodes: SankeyNode[] = [];
    const nodeMap = new Map<string, number>();

    const getNodeIndex = (name: string): number => {
      if (!nodeMap.has(name)) {
        nodes.push({ name });
        nodeMap.set(name, nodes.length - 1);
      }
      return nodeMap.get(name)!;
    };

    const links: Record<string, number> = {};
    const addLink = (source: string, target: string, count: number = 1) => {
      const key = `${source}|${target}`;
      links[key] = (links[key] || 0) + count;
    };

    let escalatedCount = 0;
    let notEscalatedCount = 0;
    let automatedCount = 0;
    const determinationBreakdown: Record<string, number> = {};
    const sourceBreakdown: Record<string, number> = {};

    // ==================== STAGE 1: Ingestion -> Categorization (from ClickHouse logs) ====================
    // Calculate category counts from log sources
    const categoryCounts: Record<string, number> = {};
    for (const [source, count] of Object.entries(logCountsBySource)) {
      let category = 'EDR';
      const sourceLower = source.toLowerCase();
      if (sourceLower.includes('sentinelone') || sourceLower.includes('crowdstrike')) {
        category = 'EDR';
      } else if (sourceLower.includes('simulate') || sourceLower.includes('simulation')) {
        category = 'Identity';
      } else if (sourceLower.includes('email') || sourceLower.includes('exchange')) {
        category = 'Email';
      } else if (sourceLower.includes('azure') || sourceLower.includes('aws') || sourceLower.includes('cloud')) {
        category = 'Cloud';
      }
      
      // Add log flow: Source -> Category
      addLink(source, category, count);
      categoryCounts[category] = (categoryCounts[category] || 0) + count;
      sourceBreakdown[source] = count;
    }

    // ==================== STAGE 2-6: From Alerts (PostgreSQL) ====================
    // Group alerts by category first
    const alertsByCategoryEnrichment: Record<string, Record<string, number>> = {};
    
    for (const alert of alertsData) {
      const categoryNode = this.categorizeAlert(alert);

      // 3. Enrichment (MITRE ATT&CK Tactic)
      const rawData = alert.rawData as any;
      let mitreTactic = rawData?.mitre_tactic || rawData?.MitreTactic || rawData?.tactic || '';
      if (!mitreTactic && alert.aiAnalysis) {
        mitreTactic = (alert.aiAnalysis as any)?.mitreTactic || '';
      }
      const enrichmentNode = mitreTactic 
        ? mitreTactic.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : 'Other';

      // 4. Agent Triage (Escalation Status)
      const isEscalated = !!alert.caseId || !!alert.promotedCaseId || ['new', 'investigating'].includes(alert.status);
      const triageNode = isEscalated ? 'Escalated' : 'Not Escalated';
      
      if (isEscalated) escalatedCount++; else notEscalatedCount++;

      // 5. Determination
      let determinationNode = 'Benign';
      if (isEscalated) {
          determinationNode = 'Suspicious';
          const aiClass = (alert.aiAnalysis as any)?.classification || '';
          if (aiClass.toLowerCase().includes('malicious')) determinationNode = 'Malicious';
          if (aiClass.toLowerCase().includes('review')) determinationNode = 'Review Recommended';
      } else {
          const aiClass = (alert.aiAnalysis as any)?.classification || '';
          if (aiClass.toLowerCase().includes('benign')) determinationNode = 'Benign';
          else if (aiClass.toLowerCase().includes('acceptable')) determinationNode = 'Acceptable Risk';
          else if (aiClass.toLowerCase().includes('mitigated')) determinationNode = 'Mitigated';
          else determinationNode = 'Benign';
      }
      
      determinationBreakdown[determinationNode] = (determinationBreakdown[determinationNode] || 0) + 1;

      // 6. Status
      let statusNode = 'Closed';
      if (['new', 'investigating'].includes(alert.status)) statusNode = 'Open';
      if (alert.status === 'in_progress') statusNode = 'In Progress';
      if (alert.case && ['open', 'investigating', 'new'].includes(alert.case.status)) statusNode = 'Open';

      // Build Flow from Categorization onward (alert-level)
      addLink(categoryNode, enrichmentNode);
      addLink(enrichmentNode, triageNode);
      addLink(triageNode, determinationNode);
      addLink(determinationNode, statusNode);

      // Time Saved Calc (15 min per auto-resolved alert)
      if (!isEscalated) automatedCount++;
    }

    // Convert links map to array
    const finalLinks: SankeyLink[] = Object.entries(links).map(([key, value]) => {
      const [sourceName, targetName] = key.split('|');
      return {
        source: getNodeIndex(sourceName),
        target: getNodeIndex(targetName),
        value
      };
    });

    const totalMinutes = automatedCount * 15;
    const timeSavedHours = Math.floor(totalMinutes / 60);
    const timeSavedMinutes = totalMinutes % 60;

    return {
      nodes,
      links: finalLinks,
      stats: {
        escalated: escalatedCount,
        notEscalated: notEscalatedCount,
        timeSavedHours,
        timeSavedMinutes,
        totalAlerts: alertsData.length,
        totalLogs,
        determinationBreakdown,
        sourceBreakdown
      }
    };

  }
}

export const analyticsService = new AnalyticsService();
