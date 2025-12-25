import { db } from '../infra/db';
import { alerts, cases } from '../infra/db/schema';
import { sql, eq, and, gte, lte, desc } from 'drizzle-orm';

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
   * Generates aggregated data for the Enterprise Insights Sankey Diagram
   */
  async getInsightsData(tenantId: string, days: number): Promise<{ nodes: SankeyNode[], links: SankeyLink[], stats: any }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

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
    const addLink = (source: string, target: string) => {
      const key = `${source}|${target}`;
      links[key] = (links[key] || 0) + 1;
    };

    let escalatedCount = 0;
    let notEscalatedCount = 0;
    let automatedCount = 0;
    const determinationBreakdown: Record<string, number> = {};

    for (const alert of alertsData) {
      // 1. Ingestion (Source)
      const sourceNode = alert.source || 'Unknown Source';

      // 2. Categorization
      // Try to use AI classification, fallback to source-based heuristic
      let categoryNode = (alert.aiAnalysis as any)?.classification || 'Unclassified';
      
      // Cleanup Category Names
      if (categoryNode.includes('Identity')) categoryNode = 'Identity';
      if (categoryNode.includes('Email')) categoryNode = 'Email';
      if (categoryNode.includes('Cloud')) categoryNode = 'Cloud';
      if (categoryNode.includes('Network')) categoryNode = 'Network';
      if (categoryNode.includes('Endpoint')) categoryNode = 'Endpoint';

      // 3. Enrichment
      // Logic: If AI Analysis exists, we assume enriched.
      const isEnriched = !!alert.aiAnalysis;
      const enrichmentNode = isEnriched ? 'Enriched Context' : 'Raw Event';

      // 4. Agent Triage (Escalation Status)
      // Logic: If linked to a case OR status is investigating/new -> Escalated
      const isEscalated = !!alert.caseId || !!alert.promotedCaseId || ['new', 'investigating'].includes(alert.status);
      const triageNode = isEscalated ? 'Escalated' : 'Not Escalated';
      
      if (isEscalated) escalatedCount++; else notEscalatedCount++;

      // 5. Determination
      let determinationNode = 'Benign';
      if (isEscalated) {
          // If escalated, defaults to Suspicious unless AI says Malicious
          determinationNode = 'Suspicious';
          const aiClass = (alert.aiAnalysis as any)?.classification || '';
          if (aiClass.toLowerCase().includes('malicious')) determinationNode = 'Malicious';
      } else {
          // If not escalated (auto-resolved), defaults to Benign/False Positive
          const aiClass = (alert.aiAnalysis as any)?.classification || '';
          if (aiClass.toLowerCase().includes('clean') || aiClass.toLowerCase().includes('benign')) determinationNode = 'Benign';
          else if (aiClass.toLowerCase().includes('malicious')) determinationNode = 'True Positive (Blocked)';
          else determinationNode = 'False Positive'; 
      }
      
      determinationBreakdown[determinationNode] = (determinationBreakdown[determinationNode] || 0) + 1;

      // 6. Status
      let statusNode = 'Closed';
      if (['new', 'investigating', 'open'].includes(alert.status)) statusNode = 'Open';
      if (alert.case && ['open', 'investigating', 'new'].includes(alert.case.status)) statusNode = 'Open';

      // Build Flow
      addLink(sourceNode, categoryNode);
      addLink(categoryNode, enrichmentNode);
      addLink(enrichmentNode, triageNode);
      addLink(triageNode, determinationNode);
      addLink(determinationNode, statusNode);

      // Time Saved Calc
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

    const timeSavedHours = Math.round((automatedCount * 15) / 60);

    return {
      nodes,
      links: finalLinks,
      stats: {
        escalated: escalatedCount,
        notEscalated: notEscalatedCount,
        timeSavedHours,
        determinationBreakdown
      }
    };
  }
}

export const analyticsService = new AnalyticsService();
