/**
 * Investigation Graph Service
 * Builds relationship graphs for case investigation
 */

import { db } from '../../infra/db';
import { cases, alerts, users } from '../../infra/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

export interface GraphNode {
  id: string;
  type: 'case' | 'alert' | 'user' | 'ip' | 'host' | 'domain' | 'file' | 'hash';
  label: string;
  properties: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'related_to' | 'originated_from' | 'targeted' | 'executed_by' | 'communicated_with';
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
      severity: caseData.priority as any
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
          severity: alert.severity as any
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

      // 3. Extract entities from alert rawData
      const rawData = alert.rawData as Record<string, any> || {};
      
      // Extract IPs
      const ips = this.extractIPs(rawData);
      for (const ip of ips) {
        const ipNodeId = `ip-${ip}`;
        if (!nodeSet.has(ipNodeId)) {
          nodes.push({
            id: ipNodeId,
            type: 'ip',
            label: ip,
            properties: { value: ip }
          });
          nodeSet.add(ipNodeId);
        }
        edges.push({
          id: `edge-${alertNodeId}-${ipNodeId}`,
          source: alertNodeId,
          target: ipNodeId,
          type: 'originated_from',
          label: 'originated from'
        });
      }

      // Extract hosts
      const hosts = this.extractHosts(rawData);
      for (const host of hosts) {
        const hostNodeId = `host-${host}`;
        if (!nodeSet.has(hostNodeId)) {
          nodes.push({
            id: hostNodeId,
            type: 'host',
            label: host,
            properties: { value: host }
          });
          nodeSet.add(hostNodeId);
        }
        edges.push({
          id: `edge-${alertNodeId}-${hostNodeId}`,
          source: alertNodeId,
          target: hostNodeId,
          type: 'targeted',
          label: 'targeted'
        });
      }

      // Extract users
      const userNames = this.extractUsers(rawData);
      for (const userName of userNames) {
        const userNodeId = `user-${userName}`;
        if (!nodeSet.has(userNodeId)) {
          nodes.push({
            id: userNodeId,
            type: 'user',
            label: userName,
            properties: { value: userName }
          });
          nodeSet.add(userNodeId);
        }
        edges.push({
          id: `edge-${alertNodeId}-${userNodeId}`,
          source: alertNodeId,
          target: userNodeId,
          type: 'executed_by',
          label: 'executed by'
        });
      }

      // Extract domains
      const domains = this.extractDomains(rawData);
      for (const domain of domains) {
        const domainNodeId = `domain-${domain}`;
        if (!nodeSet.has(domainNodeId)) {
          nodes.push({
            id: domainNodeId,
            type: 'domain',
            label: domain,
            properties: { value: domain }
          });
          nodeSet.add(domainNodeId);
        }
        edges.push({
          id: `edge-${alertNodeId}-${domainNodeId}`,
          source: alertNodeId,
          target: domainNodeId,
          type: 'communicated_with',
          label: 'communicated with'
        });
      }

      // Extract file hashes
      const hashes = this.extractHashes(rawData);
      for (const hash of hashes) {
        const hashNodeId = `hash-${hash.substring(0, 8)}`;
        if (!nodeSet.has(hashNodeId)) {
          nodes.push({
            id: hashNodeId,
            type: 'hash',
            label: hash.substring(0, 16) + '...',
            properties: { value: hash }
          });
          nodeSet.add(hashNodeId);
        }
        edges.push({
          id: `edge-${alertNodeId}-${hashNodeId}`,
          source: alertNodeId,
          target: hashNodeId,
          type: 'related_to',
          label: 'related to'
        });
      }
    }

    // Calculate summary
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

  /**
   * Build quick graph from alert
   */
  async buildAlertGraph(alertId: string, tenantId: string): Promise<InvestigationGraph> {
    const [alert] = await db.select().from(alerts).where(
      and(eq(alerts.id, alertId), eq(alerts.tenantId, tenantId))
    );

    if (!alert) {
      throw new Error('Alert not found');
    }

    // If alert has a case, build case graph
    if (alert.caseId) {
      return this.buildCaseGraph(alert.caseId, tenantId);
    }

    // Build standalone alert graph
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeSet = new Set<string>();

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
      severity: alert.severity as any
    });
    nodeSet.add(alertNodeId);

    // Extract entities from current alert
    const rawData = alert.rawData as Record<string, any> || {};
    const ips = this.extractIPs(rawData);
    const hosts = this.extractHosts(rawData);
    const users = this.extractUsers(rawData);
    const hashes = this.extractHashes(rawData);

    // Add Entity Nodes
    for (const ip of ips) {
      const id = `ip-${ip}`;
      if(!nodeSet.has(id)) {
        nodes.push({ id, type: 'ip', label: ip, properties: { value: ip } });
        nodeSet.add(id);
      }
      edges.push({ id: `e-${alertNodeId}-${id}`, source: alertNodeId, target: id, type: 'originated_from', label: 'from' });
    }
    for (const host of hosts) {
      const id = `host-${host}`;
      if(!nodeSet.has(id)) {
        nodes.push({ id, type: 'host', label: host, properties: { value: host } });
        nodeSet.add(id);
      }
      edges.push({ id: `e-${alertNodeId}-${id}`, source: alertNodeId, target: id, type: 'targeted', label: 'targeted' });
    }
    for (const user of users) {
      const id = `user-${user}`;
      if(!nodeSet.has(id)) {
        nodes.push({ id, type: 'user', label: user, properties: { value: user } });
        nodeSet.add(id);
      }
      edges.push({ id: `e-${alertNodeId}-${id}`, source: alertNodeId, target: id, type: 'executed_by', label: 'user' });
    }
     for (const hash of hashes) {
      const id = `hash-${hash.substring(0,8)}`;
      if(!nodeSet.has(id)) {
        nodes.push({ id, type: 'hash', label: hash.substring(0,8)+'...', properties: { value: hash } });
        nodeSet.add(id);
      }
      edges.push({ id: `e-${alertNodeId}-${id}`, source: alertNodeId, target: id, type: 'related_to', label: 'hash' });
    }

    // --- CORRELATION LOGIC ---
    // Fetch recent alerts to check for overlaps (Limit 100 for performance)
    const recentAlerts = await db.select().from(alerts)
        .where(
            and(
                eq(alerts.tenantId, tenantId)
            )
        )
        .limit(100); // In prod, use time window & optimized query

    for (const otherAlert of recentAlerts) {
        if (otherAlert.id === alertId) continue; // Skip self

        const otherRaw = otherAlert.rawData as Record<string, any> || {};
        const otherIPs = this.extractIPs(otherRaw);
        const otherHosts = this.extractHosts(otherRaw);
        const otherUsers = this.extractUsers(otherRaw);
        const otherHashes = this.extractHashes(otherRaw);

        let linked = false;
        let linkReason = '';

        // Check overlaps
        if (ips.some(ip => otherIPs.includes(ip))) { linked = true; linkReason = 'Shared IP'; }
        else if (hosts.some(h => otherHosts.includes(h))) { linked = true; linkReason = 'Shared Host'; }
        else if (users.some(u => otherUsers.includes(u))) { linked = true; linkReason = 'Shared User'; }
        else if (hashes.some(h => otherHashes.includes(h))) { linked = true; linkReason = 'Shared Hash'; }

        if (linked) {
            const otherNodeId = `alert-${otherAlert.id}`;
            // Add other alert node if not exists
            if (!nodeSet.has(otherNodeId)) {
                nodes.push({
                    id: otherNodeId,
                    type: 'alert',
                    label: otherAlert.title,
                    properties: {
                        source: otherAlert.source,
                        status: otherAlert.status
                    },
                    severity: otherAlert.severity as any
                });
                nodeSet.add(otherNodeId);
            }

            // Link them (via the entity usually, but for now direct link or via implicit entity node sharing)
            // Ideally we link the matched entity to this new alert.
            // Let's do that: Link the *matching entity* to the *Other Alert*
            
            // Re-find the specific matching entities and draw edges
            if (ips.some(ip => otherIPs.includes(ip))) {
                 const match = ips.find(ip => otherIPs.includes(ip));
                 if(match) edges.push({ id: `e-${otherNodeId}-ip-${match}`, source: otherNodeId, target: `ip-${match}`, type: 'related_to', label: 'shared' });
            }
            if (hosts.some(h => otherHosts.includes(h))) {
                 const match = hosts.find(h => otherHosts.includes(h));
                 if(match) edges.push({ id: `e-${otherNodeId}-host-${match}`, source: otherNodeId, target: `host-${match}`, type: 'related_to', label: 'shared' });
            }
            if (users.some(u => otherUsers.includes(u))) {
                 const match = users.find(u => otherUsers.includes(u));
                 if(match) edges.push({ id: `e-${otherNodeId}-user-${match}`, source: otherNodeId, target: `user-${match}`, type: 'related_to', label: 'shared' });
            }
        }
    }

    const nodesByType: Record<string, number> = {};
    for (const node of nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    return {
      nodes,
      edges,
      summary: { totalNodes: nodes.length, totalEdges: edges.length, nodesByType }
    };
  },

  // Helper: Extract IPs from data
  extractIPs(data: Record<string, any>): string[] {
    const ips = new Set<string>();
    const ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    
    const text = JSON.stringify(data);
    const matches = text.match(ipRegex) || [];
    matches.forEach(ip => ips.add(ip));
    
    // Also check common fields
    if (data.src_ip) ips.add(data.src_ip);
    if (data.dst_ip) ips.add(data.dst_ip);
    if (data.sourceIp) ips.add(data.sourceIp);
    if (data.destinationIp) ips.add(data.destinationIp);
    
    return Array.from(ips).slice(0, 10); // Limit to 10
  },

  // Helper: Extract hostnames
  extractHosts(data: Record<string, any>): string[] {
    const hosts = new Set<string>();
    
    if (data.hostname) hosts.add(data.hostname);
    if (data.host) hosts.add(data.host);
    if (data.computerName) hosts.add(data.computerName);
    if (data.device?.hostname) hosts.add(data.device.hostname);
    
    return Array.from(hosts).slice(0, 10);
  },

  // Helper: Extract usernames
  extractUsers(data: Record<string, any>): string[] {
    const users = new Set<string>();
    
    if (data.user) users.add(data.user);
    if (data.username) users.add(data.username);
    if (data.userName) users.add(data.userName);
    if (data.actor?.user) users.add(data.actor.user);
    
    return Array.from(users).slice(0, 10);
  },

  // Helper: Extract domains
  extractDomains(data: Record<string, any>): string[] {
    const domains = new Set<string>();
    const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
    
    const text = JSON.stringify(data);
    const matches = text.match(domainRegex) || [];
    matches.forEach(d => {
      if (!d.includes('@') && d.includes('.')) {
        domains.add(d);
      }
    });
    
    if (data.domain) domains.add(data.domain);
    
    return Array.from(domains).slice(0, 10);
  },

  // Helper: Extract hashes
  extractHashes(data: Record<string, any>): string[] {
    const hashes = new Set<string>();
    const hashRegex = /\b[a-f0-9]{32,64}\b/gi;
    
    const text = JSON.stringify(data);
    const matches = text.match(hashRegex) || [];
    matches.forEach(h => hashes.add(h));
    
    if (data.sha256) hashes.add(data.sha256);
    if (data.md5) hashes.add(data.md5);
    if (data.sha1) hashes.add(data.sha1);
    
    return Array.from(hashes).slice(0, 10);
  }
};
