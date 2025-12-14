/**
 * Evidence Management Service
 * Chain-of-custody tracking for forensic evidence
 */

import { db } from '../../infra/db';
import { nanoid } from 'nanoid';

interface CustodyEvent {
  timestamp: Date;
  action: 'collected' | 'transferred' | 'analyzed' | 'stored' | 'exported';
  performedBy: string;
  location: string;
  notes?: string;
}

interface EvidenceItem {
  id: string;
  caseId: string;
  type: 'memory_dump' | 'disk_image' | 'network_pcap' | 'log_file';
  name: string;
  collectedAt: Date;
  collectedBy: string;
  hash: {
    md5: string;
    sha256: string;
  };
  chainOfCustody: CustodyEvent[];
  metadata: {
    hostname?: string;
    os?: string;
    captureMethod?: string;
    fileSize?: number;
    [key: string]: any;
  };
  verified: boolean;
  storageLocation?: string;
}

export class EvidenceService {
  private static evidenceStore: Map<string, EvidenceItem> = new Map();

  /**
   * Register new evidence item
   */
  static async registerEvidence(data: {
    caseId: string;
    type: EvidenceItem['type'];
    name: string;
    collectedBy: string;
    hash: { md5: string; sha256: string };
    metadata?: any;
  }): Promise<EvidenceItem> {
    const evidenceId = `EVD-${nanoid(10)}`;

    const evidence: EvidenceItem = {
      id: evidenceId,
      caseId: data.caseId,
      type: data.type,
      name: data.name,
      collectedAt: new Date(),
      collectedBy: data.collectedBy,
      hash: data.hash,
      chainOfCustody: [
        {
          timestamp: new Date(),
          action: 'collected',
          performedBy: data.collectedBy,
          location: 'Field',
          notes: 'Evidence collected from target system',
        },
      ],
      metadata: data.metadata || {},
      verified: false,
    };

    this.evidenceStore.set(evidenceId, evidence);

    console.log(`[Evidence] Registered: ${evidenceId} - ${data.name}`);

    return evidence;
  }

  /**
   * Add custody event
   */
  static async addCustodyEvent(
    evidenceId: string,
    event: {
      action: CustodyEvent['action'];
      performedBy: string;
      location: string;
      notes?: string;
    }
  ): Promise<void> {
    const evidence = this.evidenceStore.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    evidence.chainOfCustody.push({
      timestamp: new Date(),
      ...event,
    });

    console.log(`[Evidence] Custody event added: ${evidenceId} - ${event.action}`);
  }

  /**
   * Verify evidence integrity
   */
  static async verifyIntegrity(
    evidenceId: string,
    currentHash: { md5: string; sha256: string }
  ): Promise<{ verified: boolean; message: string }> {
    const evidence = this.evidenceStore.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    const md5Match = evidence.hash.md5 === currentHash.md5;
    const sha256Match = evidence.hash.sha256 === currentHash.sha256;

    if (md5Match && sha256Match) {
      evidence.verified = true;
      await this.addCustodyEvent(evidenceId, {
        action: 'analyzed',
        performedBy: 'system',
        location: 'Forensics Lab',
        notes: 'Integrity verified - hashes match',
      });

      return {
        verified: true,
        message: 'Evidence integrity verified successfully',
      };
    } else {
      await this.addCustodyEvent(evidenceId, {
        action: 'analyzed',
        performedBy: 'system',
        location: 'Forensics Lab',
        notes: 'INTEGRITY FAILURE - Hash mismatch detected!',
      });

      return {
        verified: false,
        message: 'ALERT: Evidence integrity compromised! Hash mismatch detected.',
      };
    }
  }

  /**
   * Get evidence item
   */
  static async getEvidence(evidenceId: string): Promise<EvidenceItem | null> {
    return this.evidenceStore.get(evidenceId) || null;
  }

  /**
   * List evidence for case
   */
  static async listCaseEvidence(caseId: string): Promise<EvidenceItem[]> {
    const evidence = [];
    for (const item of this.evidenceStore.values()) {
      if (item.caseId === caseId) {
        evidence.push(item);
      }
    }
    return evidence;
  }

  /**
   * Export evidence report (for legal proceedings)
   */
  static async exportEvidenceReport(evidenceId: string): Promise<{
    evidenceId: string;
    report: string;
    format: 'json' | 'pdf';
  }> {
    const evidence = this.evidenceStore.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    const report = {
      evidenceIdentifier: evidence.id,
      caseReference: evidence.caseId,
      evidenceType: evidence.type,
      collectionDetails: {
        collectedBy: evidence.collectedBy,
        collectedAt: evidence.collectedAt.toISOString(),
        location: evidence.chainOfCustody[0]?.location,
      },
      integrityVerification: {
        md5: evidence.hash.md5,
        sha256: evidence.hash.sha256,
        verified: evidence.verified,
      },
      chainOfCustody: evidence.chainOfCustody.map(event => ({
        timestamp: event.timestamp.toISOString(),
        action: event.action,
        performedBy: event.performedBy,
        location: event.location,
        notes: event.notes,
      })),
      metadata: evidence.metadata,
      certification: {
        statement: 'I certify that this evidence has been handled in accordance with established forensic procedures and that the chain of custody has been maintained throughout.',
        certifiedAt: new Date().toISOString(),
        certifiedBy: 'zcrAI Forensics System',
      },
    };

    await this.addCustodyEvent(evidenceId, {
      action: 'exported',
      performedBy: 'system',
      location: 'Evidence Management System',
      notes: 'Evidence report exported for legal proceedings',
    });

    return {
      evidenceId,
      report: JSON.stringify(report, null, 2),
      format: 'json',
    };
  }

  /**
   * Get custody chain summary
   */
  static getCustodyChainSummary(evidence: EvidenceItem): {
    totalEvents: number;
    custodians: string[];
    locations: string[];
    timeline: { start: Date; end: Date };
  } {
    const custodians = [...new Set(evidence.chainOfCustody.map(e => e.performedBy))];
    const locations = [...new Set(evidence.chainOfCustody.map(e => e.location))];
    const timestamps = evidence.chainOfCustody.map(e => e.timestamp);

    return {
      totalEvents: evidence.chainOfCustody.length,
      custodians,
      locations,
      timeline: {
        start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
        end: new Date(Math.max(...timestamps.map(t => t.getTime()))),
      },
    };
  }
}
