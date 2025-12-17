// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardBody, CardHeader, Chip, Button, Spinner } from '@heroui/react';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../shared/api/api';
import { Icon } from '../shared/ui';

interface GraphNode {
  id: string;
  type: 'case' | 'alert' | 'user' | 'ip' | 'host' | 'domain' | 'file' | 'hash' | 'process';
  label: string;
  properties: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
}

interface InvestigationGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
  };
}

// Color palette for node types
const NODE_COLORS: Record<string, string> = {
  case: '#6366F1',      // Indigo
  alert: '#EF4444',     // Red
  user: '#10B981',      // Green
  ip: '#F59E0B',        // Amber
  host: '#8B5CF6',      // Violet
  domain: '#06B6D4',    // Cyan
  file: '#EC4899',      // Pink
  hash: '#84CC16',      // Lime
  process: '#F43F5E',   // Rose (Process/Action)
};

// Node size by type
const NODE_SIZES: Record<string, number> = {
  case: 20,
  alert: 16,
  user: 10,
  host: 10,
  process: 8,
  ip: 8,
  domain: 8,
  file: 8,
  hash: 8,
};

// ... (existing code for component) ...

// Mock data for demo
const mockGraphData: InvestigationGraphData = {
  nodes: [
    // Case Root
    { id: 'case-1', type: 'case', label: 'Ransomware Incident', properties: { status: 'open', severity: 'critical' }, severity: 'critical' },
    
    // Alerts
    { id: 'alert-1', type: 'alert', label: 'Suspicious PowerShell', properties: { source: 'EDR' }, severity: 'high' },
    
    // Entities involved in the chain
    { id: 'user-1', type: 'user', label: 'john.doe', properties: { role: 'Admin', dept: 'IT' } },
    { id: 'host-1', type: 'host', label: 'WORKSTATION-01', properties: { os: 'Windows 11', ip: '192.168.1.105' } },
    { id: 'proc-1', type: 'process', label: 'powershell.exe', properties: { pid: 4566, cmd: '-enc AAB...' } },
    { id: 'ip-1', type: 'ip', label: '185.220.101.1', properties: { country: 'RU', asn: 'AS1234' } },
    
    // Side Artifacts
    { id: 'file-1', type: 'file', label: 'payload.exe', properties: { size: '45KB' } },
    { id: 'hash-1', type: 'hash', label: 'a1b2c...99', properties: { type: 'SHA256' } }
  ],
  edges: [
    // Hierarchy
    { id: 'e1', source: 'case-1', target: 'alert-1', type: 'contains', label: 'contains' },
    
    // The Attack Chain (Story)
    { id: 'e2', source: 'alert-1', target: 'host-1', type: 'detected_on', label: 'on' },
    { id: 'e3', source: 'host-1', target: 'user-1', type: 'logged_in', label: 'user' },
    { id: 'e4', source: 'user-1', target: 'proc-1', type: 'spawned', label: 'ran' },
    { id: 'e5', source: 'proc-1', target: 'ip-1', type: 'network_con', label: 'connects to' },
    { id: 'e6', source: 'proc-1', target: 'file-1', type: 'wrote', label: 'dropped' },
    { id: 'e7', source: 'file-1', target: 'hash-1', type: 'has_hash', label: 'hash' },
  ],
  summary: {
    totalNodes: 8,
    totalEdges: 7,
    nodesByType: { case: 1, alert: 1, user: 1, host: 1, process: 1, ip: 1, file: 1, hash: 1 },
  }
};
