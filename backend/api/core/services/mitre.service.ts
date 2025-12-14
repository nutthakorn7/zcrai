/**
 * MITRE ATT&CK Service
 * Provides tactics/techniques mapping and coverage analysis
 */

import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { sql, eq, and, gte } from 'drizzle-orm';

// MITRE ATT&CK Framework (Enterprise Matrix - Key Tactics)
const MITRE_TACTICS = [
  { id: 'TA0001', name: 'Initial Access', shortName: 'Initial Access' },
  { id: 'TA0002', name: 'Execution', shortName: 'Execution' },
  { id: 'TA0003', name: 'Persistence', shortName: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation', shortName: 'Priv Esc' },
  { id: 'TA0005', name: 'Defense Evasion', shortName: 'Defense Evasion' },
  { id: 'TA0006', name: 'Credential Access', shortName: 'Cred Access' },
  { id: 'TA0007', name: 'Discovery', shortName: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement', shortName: 'Lateral Mvmt' },
  { id: 'TA0009', name: 'Collection', shortName: 'Collection' },
  { id: 'TA0010', name: 'Exfiltration', shortName: 'Exfiltration' },
  { id: 'TA0011', name: 'Command and Control', shortName: 'C2' },
  { id: 'TA0040', name: 'Impact', shortName: 'Impact' },
];

// Top techniques per tactic (simplified)
const TECHNIQUE_MAP: Record<string, Array<{ id: string; name: string }>> = {
  'TA0001': [
    { id: 'T1566', name: 'Phishing' },
    { id: 'T1190', name: 'Exploit Public-Facing App' },
    { id: 'T1078', name: 'Valid Accounts' },
  ],
  'TA0002': [
    { id: 'T1059', name: 'Command/Scripting Interpreter' },
    { id: 'T1204', name: 'User Execution' },
    { id: 'T1053', name: 'Scheduled Task/Job' },
  ],
  'TA0003': [
    { id: 'T1547', name: 'Boot/Logon Autostart' },
    { id: 'T1053', name: 'Scheduled Task/Job' },
    { id: 'T1136', name: 'Create Account' },
  ],
  'TA0004': [
    { id: 'T1548', name: 'Abuse Elevation Control' },
    { id: 'T1068', name: 'Exploitation for Priv Esc' },
    { id: 'T1134', name: 'Access Token Manipulation' },
  ],
  'TA0005': [
    { id: 'T1070', name: 'Indicator Removal' },
    { id: 'T1562', name: 'Impair Defenses' },
    { id: 'T1036', name: 'Masquerading' },
  ],
  'TA0006': [
    { id: 'T1110', name: 'Brute Force' },
    { id: 'T1003', name: 'OS Credential Dumping' },
    { id: 'T1555', name: 'Credentials from Password Stores' },
  ],
  'TA0007': [
    { id: 'T1087', name: 'Account Discovery' },
    { id: 'T1083', name: 'File and Directory Discovery' },
    { id: 'T1057', name: 'Process Discovery' },
  ],
  'TA0008': [
    { id: 'T1021', name: 'Remote Services' },
    { id: 'T1550', name: 'Use Alternate Auth Material' },
    { id: 'T1570', name: 'Lateral Tool Transfer' },
  ],
  'TA0009': [
    { id: 'T1005', name: 'Data from Local System' },
    { id: 'T1114', name: 'Email Collection' },
    { id: 'T1560', name: 'Archive Collected Data' },
  ],
  'TA0010': [
    { id: 'T1041', name: 'Exfiltration Over C2' },
    { id: 'T1567', name: 'Exfiltration Over Web Service' },
    { id: 'T1048', name: 'Exfiltration Over Alt Protocol' },
  ],
  'TA0011': [
    { id: 'T1071', name: 'Application Layer Protocol' },
    { id: 'T1095', name: 'Non-Application Layer Protocol' },
    { id: 'T1572', name: 'Protocol Tunneling' },
  ],
  'TA0040': [
    { id: 'T1486', name: 'Data Encrypted for Impact' },
    { id: 'T1489', name: 'Service Stop' },
    { id: 'T1490', name: 'Inhibit System Recovery' },
  ],
};

// Keyword mapping for auto-detection
const KEYWORD_TACTIC_MAP: Record<string, string> = {
  phish: 'TA0001', spam: 'TA0001', email: 'TA0001',
  powershell: 'TA0002', script: 'TA0002', cmd: 'TA0002', exec: 'TA0002',
  persist: 'TA0003', autorun: 'TA0003', startup: 'TA0003',
  privilege: 'TA0004', elevation: 'TA0004', admin: 'TA0004',
  bypass: 'TA0005', disable: 'TA0005', tamper: 'TA0005',
  credential: 'TA0006', password: 'TA0006', brute: 'TA0006', login: 'TA0006',
  discovery: 'TA0007', enum: 'TA0007', scan: 'TA0007',
  lateral: 'TA0008', rdp: 'TA0008', ssh: 'TA0008', smb: 'TA0008',
  collect: 'TA0009', archive: 'TA0009', zip: 'TA0009',
  exfil: 'TA0010', upload: 'TA0010', transfer: 'TA0010',
  beacon: 'TA0011', c2: 'TA0011', callback: 'TA0011',
  encrypt: 'TA0040', ransom: 'TA0040', wipe: 'TA0040', destroy: 'TA0040',
};

export interface TacticCoverage {
  id: string;
  name: string;
  shortName: string;
  count: number;
  techniques: Array<{ id: string; name: string; count: number }>;
  intensity: number; // 0-1 for heatmap coloring
}

export const MitreService = {
  /**
   * Get MITRE ATT&CK coverage based on alerts
   */
  async getCoverage(tenantId: string, days: number = 30): Promise<TacticCoverage[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all alerts with their titles/descriptions
    const alertList = await db.select({
      id: alerts.id,
      title: alerts.title,
      description: alerts.description,
      severity: alerts.severity
    })
    .from(alerts)
    .where(and(
      eq(alerts.tenantId, tenantId),
      gte(alerts.createdAt, startDate)
    ));

    // Count tactics based on keyword matching
    const tacticCounts: Record<string, number> = {};
    const techniqueCounts: Record<string, Record<string, number>> = {};

    alertList.forEach(alert => {
      const text = `${alert.title} ${alert.description || ''}`.toLowerCase();
      
      Object.entries(KEYWORD_TACTIC_MAP).forEach(([keyword, tacticId]) => {
        if (text.includes(keyword)) {
          tacticCounts[tacticId] = (tacticCounts[tacticId] || 0) + 1;
          
          // Assign to first technique in tactic
          const techniques = TECHNIQUE_MAP[tacticId];
          if (techniques && techniques.length > 0) {
            if (!techniqueCounts[tacticId]) techniqueCounts[tacticId] = {};
            const techId = techniques[0].id;
            techniqueCounts[tacticId][techId] = (techniqueCounts[tacticId][techId] || 0) + 1;
          }
        }
      });
    });

    // Find max for intensity normalization
    const maxCount = Math.max(1, ...Object.values(tacticCounts));

    // Build coverage response
    const coverage: TacticCoverage[] = MITRE_TACTICS.map(tactic => {
      const count = tacticCounts[tactic.id] || 0;
      const techniques = (TECHNIQUE_MAP[tactic.id] || []).map(tech => ({
        id: tech.id,
        name: tech.name,
        count: techniqueCounts[tactic.id]?.[tech.id] || 0
      }));

      return {
        id: tactic.id,
        name: tactic.name,
        shortName: tactic.shortName,
        count,
        techniques,
        intensity: count / maxCount
      };
    });

    return coverage;
  },

  /**
   * Get summary statistics
   */
  async getSummary(tenantId: string, days: number = 30) {
    const coverage = await this.getCoverage(tenantId, days);
    
    const totalDetections = coverage.reduce((sum, t) => sum + t.count, 0);
    const activeTactics = coverage.filter(t => t.count > 0).length;
    const totalTactics = coverage.length;
    
    // Top tactics
    const topTactics = [...coverage]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalDetections,
      activeTactics,
      totalTactics,
      coveragePercent: Math.round((activeTactics / totalTactics) * 100),
      topTactics
    };
  }
};
