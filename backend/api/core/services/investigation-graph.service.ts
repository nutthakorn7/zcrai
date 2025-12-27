import { db } from '../../infra/db';
import { cases, alerts } from '../../infra/db/schema';
import { eq, and } from 'drizzle-orm';
import { clickhouse, query } from '../../infra/clickhouse/client';

export interface GraphNode {
  id: string;
  type: 'case' | 'alert' | 'user' | 'ip' | 'host' | 'domain' | 'file' | 'hash' | 'agent_finding' | 'memory_pattern';
  label: string;
  properties: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  val?: number; // Visual weight
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'related_to' | 'originated_from' | 'targeted' | 'executed_by' | 'communicated_with' | 'concluded_by' | 'recalled_from';
  label: string;
}

export interface InvestigationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
  };
}

export const InvestigationGraphService = {
  /**
   * Build investigation graph for a case
   */
  async buildCaseGraph(caseId: string, tenantId: string): Promise<InvestigationGraph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeSet = new Set<string>();

    // 1. Get case details
    const [caseData] = await db.select().from(cases).where(
      and(eq(cases.id, caseId), eq(cases.tenantId, tenantId))
    );

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Add case as root node
    const caseNodeId = `case-${caseData.id}`;
    nodes.push({
      id: caseNodeId,
      type: 'case',
      label: caseData.title,
      properties: {
        status: caseData.status,
        priority: caseData.priority,
        createdAt: caseData.createdAt
      },
      severity: caseData.priority as any,
      val: 30
    });
    nodeSet.add(caseNodeId);

    // 2. Get related alerts
    const relatedAlerts = await db.select().from(alerts).where(
      and(eq(alerts.caseId, caseId), eq(alerts.tenantId, tenantId))
    );

    for (const alert of relatedAlerts) {
      const alertNodeId = `alert-${alert.id}`;
      if (!nodeSet.has(alertNodeId)) {
        nodes.push({
          id: alertNodeId,
          type: 'alert',
          label: alert.title,
          properties: {
            source: alert.source,
            status: alert.status,
            createdAt: alert.createdAt
          },
          severity: alert.severity as any,
          val: 20
        });
        nodeSet.add(alertNodeId);
      }

      // Edge: case contains alert
      edges.push({
        id: `edge-${caseNodeId}-${alertNodeId}`,
        source: caseNodeId,
        target: alertNodeId,
        type: 'contains',
        label: 'contains'
      });

      // Expand entities for this alert using ClickHouse extraction (or rawData if sufficient)
      // For now, use the same helper extracting from rawData, 
      // but in future we could use CH for deeper entity info.
      await this.expandAlertEntities(alert, nodes, edges, nodeSet, tenantId, false);
    }

    return this.finalizeGraph(nodes, edges);
  },

  /**
   * Build quick graph from alert with Real ClickHouse Correlation
   */
  async buildAlertGraph(alertId: string, tenantId: string): Promise<InvestigationGraph> {
    const [alert] = await db.select().from(alerts).where(
      and(eq(alerts.id, alertId), eq(alerts.tenantId, tenantId))
    );

    if (!alert) {
      throw new Error('Alert not found');
    }

    // If alert has a case, build case graph (optional, but let's stick to alert-centric for now)
    // if (alert.caseId) { return this.buildCaseGraph(alert.caseId, tenantId); }

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeSet = new Set<string>();

    // 1. Add Main Alert Node
    const alertNodeId = `alert-${alert.id}`;
    nodes.push({
      id: alertNodeId,
      type: 'alert',
      label: alert.title,
      properties: {
        source: alert.source,
        status: alert.status,
        createdAt: alert.createdAt
      },
      severity: alert.severity as any,
      val: 25 // Main focus
    });
    nodeSet.add(alertNodeId);

    // 2. Extract Entities form Main Alert
    const entities = await this.expandAlertEntities(alert, nodes, edges, nodeSet, tenantId, true);

    // 3. Find Correlations via ClickHouse
    // We look for OTHER alerts/events in CH that share these entities
    if (entities.length > 0) {
      await this.findCorrelations(tenantId, alertId, entities, nodes, edges, nodeSet);
    }

    // 4. ADDED: AI Insights & Memory
    this.expandAIInsights(alert, nodes, edges, nodeSet);

    return this.finalizeGraph(nodes, edges);
  },

  /**
   * Helper: Add AI Findings and Historical Context to the graph
   */
  expandAIInsights(alert: any, nodes: GraphNode[], edges: GraphEdge[], nodeSet: Set<string>) {
    const aiAnalysis = alert.aiAnalysis as any;
    if (!aiAnalysis) return;

    const alertNodeId = `alert-${alert.id}`;

    // Add Swarm Findings
    if (aiAnalysis.swarmFindings && Array.isArray(aiAnalysis.swarmFindings)) {
      aiAnalysis.swarmFindings.forEach((finding: any, index: number) => {
        const findingNodeId = `finding-${alert.id}-${index}`;
        if (!nodeSet.has(findingNodeId)) {
          nodes.push({
            id: findingNodeId,
            type: 'agent_finding',
            label: `${finding.agent}: ${finding.summary.substring(0, 30)}...`,
            properties: {
              agent: finding.agent,
              summary: finding.summary,
              data: finding.data
            },
            val: 15
          });
          nodeSet.add(findingNodeId);

          edges.push({
            id: `edge-${alertNodeId}-${findingNodeId}`,
            source: alertNodeId,
            target: findingNodeId,
            type: 'concluded_by',
            label: 'finding'
          });
        }
      });
    }

    // Add Memory / Historical Context
    // We can infer historical context from a previous RAG step or by checking alert.historicalContext if populated
    // Note: Since ManagerAgent stores report, we can also extract "Past Case" mentions if we had them saved specifically
    // For now, let's look at swarmFindings for anything that looks like memory recall
    const memoryFindings = aiAnalysis.swarmFindings?.filter((f: any) => f.agent === 'Manager' && f.summary.includes('historical context'));
    if (memoryFindings) {
      memoryFindings.forEach((m: any, index: number) => {
        const memoryNodeId = `memory-${alert.id}-${index}`;
        if (!nodeSet.has(memoryNodeId)) {
          nodes.push({
            id: memoryNodeId,
            type: 'memory_pattern',
            label: 'Recalled Pattern',
            properties: { summary: m.summary },
            val: 12
          });
          nodeSet.add(memoryNodeId);

          edges.push({
            id: `edge-${alertNodeId}-${memoryNodeId}`,
            source: alertNodeId,
            target: memoryNodeId,
            type: 'recalled_from',
            label: 'memory'
          });
        }
      });
    }
  },

  // Helper: Extract entities from alert and add to graph
  // Returns list of {type, value} for correlation
  async expandAlertEntities(
    alert: any, 
    nodes: GraphNode[], 
    edges: GraphEdge[], 
    nodeSet: Set<string>, 
    tenantId: string,
    isRoot: boolean
  ) {
    const rawData = alert.rawData as Record<string, any> || {};
    const alertNodeId = `alert-${alert.id}`;
    const entities: { type: string, value: string }[] = [];

    const addEntity = (type: GraphNode['type'], value: string, relation: GraphEdge['type'], label: string) => {
      if (!value || value === '-' || value === 'unknown' || value === '127.0.0.1') return; // Filter noise
      
      const nodeId = `${type}-${value}`;
      if (!nodeSet.has(nodeId)) {
        nodes.push({
          id: nodeId,
          type,
          label: value,
          properties: { value },
          val: isRoot ? 15 : 10
        });
        nodeSet.add(nodeId);
      }
      
      // Prevent duplicate edges
      const edgeId = `e-${alertNodeId}-${nodeId}`;
      if (!edges.some(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: alertNodeId,
          target: nodeId,
          type: relation,
          label
        });
      }
      
      if (isRoot) {
        entities.push({ type, value });
      }
    };

    // Extract IPs
    const ips = this.extractIPs(rawData);
    ips.forEach(ip => addEntity('ip', ip, 'originated_from', 'IP'));

    // Extract Hosts
    const hosts = this.extractHosts(rawData);
    hosts.forEach(host => addEntity('host', host, 'targeted', 'Host'));

    // Extract Users
    const users = this.extractUsers(rawData);
    users.forEach(user => addEntity('user', user, 'executed_by', 'User'));

    // Extract Hashes
    const hashes = this.extractHashes(rawData);
    hashes.forEach(hash => addEntity('hash', hash, 'related_to', 'Hash'));

    return entities;
  },

  // Helper: Find correlated events in ClickHouse
  async findCorrelations(
    tenantId: string, 
    originalAlertId: string, 
    entities: { type: string, value: string }[], 
    nodes: GraphNode[], 
    edges: GraphEdge[], 
    nodeSet: Set<string>
  ) {
    if (entities.length === 0) return;

    // Group values by type for query optimization
    const ips = entities.filter(e => e.type === 'ip').map(e => e.value);
    const hosts = entities.filter(e => e.type === 'host').map(e => e.value);
    const users = entities.filter(e => e.type === 'user').map(e => e.value);
    const hashes = entities.filter(e => e.type === 'hash').map(e => e.value);

    // Build WHERE clause parts
    const conditions: string[] = [];
    if (ips.length > 0) conditions.push(`host_ip IN ('${ips.join("','")}') OR network_src_ip IN ('${ips.join("','")}') OR network_dst_ip IN ('${ips.join("','")}')`);
    if (hosts.length > 0) conditions.push(`host_name IN ('${hosts.join("','")}')`);
    if (users.length > 0) conditions.push(`user_name IN ('${users.join("','")}')`);
    if (hashes.length > 0) conditions.push(`file_hash IN ('${hashes.join("','")}') OR file_sha256 IN ('${hashes.join("','")}')`);

    if (conditions.length === 0) return;

    const whereClause = conditions.join(' OR ');

    // Query 20 most recent correlated events using PREWHERE for massive performance gain on huge datasets
    const sql = `
      SELECT 
        id, 
        title, 
        source, 
        event_type, 
        timestamp,
        host_ip,
        host_name,
        user_name,
        file_hash
      FROM security_events
      PREWHERE tenant_id = {tenantId:String}
        AND timestamp >= now() - INTERVAL 7 DAY
      WHERE id != {originalAlertId:String}
        AND (${whereClause})
      ORDER BY timestamp DESC
      LIMIT 20
    `;

    try {
      const correlatedEvents = await query<any>(sql, { tenantId, originalAlertId });

      for (const event of correlatedEvents) {
        const eventNodeId = `alert-${event.id}`; // Treating significant events as "alerts" in logic
        
        let isNew = false;
        if (!nodeSet.has(eventNodeId)) {
          nodes.push({
            id: eventNodeId,
            type: 'alert', // Visualizing as alert/event
            label: event.title || event.event_type || 'Unknown Event',
            properties: {
              source: event.source,
              timestamp: event.timestamp
            },
            severity: 'medium', // Default for correlated events
            val: 15
          });
          nodeSet.add(eventNodeId);
          isNew = true;
        }

        // Link this event to the shared entities
        // We know it matched *some* entity, but we need to draw the line logic
        // Simple approach: Check overlap again in memory for edge creation
        
        if (ips.includes(event.host_ip)) {
           this.addEdge(edges, eventNodeId, `ip-${event.host_ip}`, 'related_to');
        }
        if (hosts.includes(event.host_name)) {
           this.addEdge(edges, eventNodeId, `host-${event.host_name}`, 'targeted');
        }
        if (users.includes(event.user_name)) {
           this.addEdge(edges, eventNodeId, `user-${event.user_name}`, 'executed_by');
        }
        if (hashes.includes(event.file_hash)) {
           this.addEdge(edges, eventNodeId, `hash-${event.file_hash}`, 'related_to');
        }
      }
    } catch (error) {
      console.error('Failed to query ClickHouse correlations:', error);
    }
  },

  addEdge(edges: GraphEdge[], source: string, target: string, type: GraphEdge['type']) {
    const id = `edge-${source}-${target}`; // Directional ID
    // Check both directions to avoid double links if undirected visual
    // But ForceGraph is directional. Let's keep it simple.
    if (!edges.some(e => e.id === id)) {
        edges.push({ id, source, target, type, label: type });
    }
  },

  finalizeGraph(nodes: GraphNode[], edges: GraphEdge[]): InvestigationGraph {
    const nodesByType: Record<string, number> = {};
    for (const node of nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }
    return {
      nodes,
      edges,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        nodesByType
      }
    };
  },

  // --- Extract Helpers (Same as before but refined) ---

  extractIPs(data: Record<string, any>): string[] {
    const ips = new Set<string>();
    const ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    
    // Performance: Instead of full stringify, target specific fields first
    const prioritizedData = {
      src: data.src_ip || data.source_ip || data.network_src_ip,
      dst: data.dst_ip || data.dest_ip || data.network_dst_ip,
      host: data.host_ip || data.device_ip
    };
    
    const text = JSON.stringify(data);
    const matches = text.match(ipRegex) || [];
    matches.forEach(ip => ips.add(ip));
    // Explicit fields
    if (data.src_ip) ips.add(data.src_ip);
    if (data.dst_ip) ips.add(data.dst_ip);
    if (data.host_ip) ips.add(data.host_ip);
    return Array.from(ips).slice(0, 5); // Limit per alert
  },

  extractHosts(data: Record<string, any>): string[] {
    const hosts = new Set<string>();
    if (data.hostname) hosts.add(data.hostname);
    if (data.host) hosts.add(data.host);
    if (data.computerName) hosts.add(data.computerName);
    if (data.host_name) hosts.add(data.host_name);
    return Array.from(hosts).slice(0, 5);
  },

  extractUsers(data: Record<string, any>): string[] {
    const users = new Set<string>();
    if (data.user) users.add(data.user);
    if (data.username) users.add(data.username);
    if (data.user_name) users.add(data.user_name);
    return Array.from(users).filter(u => u !== 'system' && u !== 'SYSTEM').slice(0, 5);
  },

  extractHashes(data: Record<string, any>): string[] {
    const hashes = new Set<string>();
    const hashRegex = /\b[a-f0-9]{32,64}\b/gi;
    const text = JSON.stringify(data);
    const matches = text.match(hashRegex) || [];
    matches.forEach(h => hashes.add(h));
    return Array.from(hashes).slice(0, 5);
  },

  /**
   * Get the latest alert with correlation data for dashboard display
   * Returns the graph data or null if no suitable alert found
   */
  async getLatestCorrelatedAlert(tenantId: string): Promise<{ alertId: string; graph: InvestigationGraph } | null> {
    try {
      // Query ClickHouse for recent high-severity events that have entity data
      const sql = `
        SELECT 
          id, 
          title, 
          source, 
          severity,
          timestamp,
          host_ip,
          host_name,
          user_name,
          file_hash
        FROM security_events
        WHERE tenant_id = {tenantId:String}
          AND severity IN ('critical', 'high')
          AND (
            host_ip != '' OR 
            host_name != '' OR 
            user_name != '' OR 
            file_hash != ''
          )
          AND timestamp >= now() - INTERVAL 7 DAY
        ORDER BY 
          CASE severity 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            ELSE 3 
          END,
          timestamp DESC
        LIMIT 1
      `;

      const events = await query<any>(sql, { tenantId });
      
      if (!events || events.length === 0) {
        return null;
      }

      const event = events[0];
      
      // Build a simple graph from this event
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const nodeSet = new Set<string>();

      // Add the main alert node
      const alertNodeId = `alert-${event.id}`;
      nodes.push({
        id: alertNodeId,
        type: 'alert',
        label: event.title || 'Security Event',
        properties: {
          source: event.source,
          timestamp: event.timestamp
        },
        severity: event.severity as any,
        val: 25
      });
      nodeSet.add(alertNodeId);

      // Add entity nodes
      const addEntity = (type: GraphNode['type'], value: string, relation: GraphEdge['type']) => {
        if (!value || value === '' || value === '-' || value === 'unknown') return;
        const nodeId = `${type}-${value}`;
        if (!nodeSet.has(nodeId)) {
          nodes.push({
            id: nodeId,
            type,
            label: value,
            properties: { value },
            val: 12
          });
          nodeSet.add(nodeId);
        }
        edges.push({
          id: `edge-${alertNodeId}-${nodeId}`,
          source: alertNodeId,
          target: nodeId,
          type: relation,
          label: relation
        });
      };

      if (event.host_ip) addEntity('ip', event.host_ip, 'originated_from');
      if (event.host_name) addEntity('host', event.host_name, 'targeted');
      if (event.user_name) addEntity('user', event.user_name, 'executed_by');
      if (event.file_hash) addEntity('hash', event.file_hash, 'related_to');

      return {
        alertId: event.id,
        graph: this.finalizeGraph(nodes, edges)
      };
    } catch (error) {
      console.error('Failed to get latest correlated alert:', error);
      return null;
    }
  }
};

