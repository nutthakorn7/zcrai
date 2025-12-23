import { db } from '../../infra/db';
import { alerts, alertCorrelations, cases } from '../../infra/db/schema';
import { eq, and, desc, inArray, sql, or, gte, lte } from 'drizzle-orm';
import { ObservableService } from './observable.service';
import { NotificationChannelService } from './notification-channel.service';
import crypto from 'crypto';

export class AlertService {
  /**
   * Generate fingerprint for alert deduplication
   * Fingerprint is based on: source + severity + title + observables
   */
  private static generateFingerprint(data: {
    source: string;
    severity: string;
    title: string;
    observables?: string[];
  }): string {
    const parts = [
      data.source.toLowerCase().trim(),
      data.severity.toLowerCase().trim(),
      data.title.toLowerCase().trim(),
      ...(data.observables || []).sort() // Sort for consistency
    ];
    
    return crypto
      .createHash('sha256')
      .update(parts.join('|'))
      .digest('hex');
  }

  // Create new alert with deduplication
  static async create(data: {
    tenantId: string;
    source: string;
    severity: string;
    title: string;
    description: string;
    rawData?: any;
    observables?: string[]; // For fingerprint generation
  }) {
    // 1. Generate fingerprint for deduplication
    const fingerprint = this.generateFingerprint({
      source: data.source,
      severity: data.severity,
      title: data.title,
      observables: data.observables
    });

    // 2. Check for existing alert with same fingerprint in last 24 hours
    const dedupeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
    const existingAlerts = await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.tenantId, data.tenantId),
        eq(alerts.fingerprint, fingerprint),
        gte(alerts.lastSeenAt, dedupeWindow)
      ))
      .limit(1);

    // 3. If duplicate found, increment count and update timestamp
    if (existingAlerts.length > 0) {
      const existingAlert = existingAlerts[0];
      
      const [updatedAlert] = await db
        .update(alerts)
        .set({
          duplicateCount: sql`${alerts.duplicateCount} + 1`,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
          // Also update description with latest info
          description: data.description,
          rawData: data.rawData
        })
        .where(eq(alerts.id, existingAlert.id))
        .returning();

      return updatedAlert;
    }

    // 4. Otherwise, create new alert
    const [alert] = await db.insert(alerts).values({
      tenantId: data.tenantId,
      source: data.source,
      severity: data.severity,
      title: data.title,
      description: data.description,
      rawData: data.rawData,
      status: 'new',
      fingerprint,
      duplicateCount: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    }).returning();

    // Auto-extract IOCs from description + rawData
    const textToScan = data.description + (data.rawData ? JSON.stringify(data.rawData) : '');
    const extractedIOCs = await ObservableService.extract(textToScan, data.tenantId, undefined, alert.id);

    // Auto-correlate after creation
    await this.correlate(alert.id);

    // Auto-notify
    try {
        await NotificationChannelService.send(data.tenantId, {
            type: 'alert',
            severity: data.severity,
            title: `New Alert: ${data.title}`,
            message: `${data.description}${data.source ? `\nSource: ${data.source}` : ''}`,
            metadata: { alertId: alert.id }
        });
    } catch (err) {
        console.error('Failed to send notification', err);
    }

    // Auto-Triage (AI SOC Phase 1)
    // Fire-and-forget: Analyze alert immediately
    import('./ai-triage.service').then(({ AITriageService }) => {
        AITriageService.analyze(alert.id, { 
            ...data, 
            tenantId: data.tenantId, 
            rawData: data.rawData,
            observables: extractedIOCs 
        });
    }).catch(err => console.error('Failed to trigger AI Triage', err));

    // Emit real-time event
    import('./socket.service').then(({ SocketService }) => {
        SocketService.broadcast(data.tenantId, 'new_alert', alert);
    }).catch(err => console.error('Failed to emit real-time alert', err));

    return alert;
  }

  // List alerts with filters
  static async list(filters: {
    tenantId?: string; // Optional for superadmin
    status?: string[];
    severity?: string[];
    source?: string[];
    aiStatus?: string[]; // 'verified', 'blocked', 'pending'
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    
    // Only filter by tenantId if provided (non-superadmin users)
    if (filters.tenantId) {
      conditions.push(eq(alerts.tenantId, filters.tenantId));
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(alerts.status, filters.status));
    }

    if (filters.severity && filters.severity.length > 0) {
      conditions.push(inArray(alerts.severity, filters.severity));
    }

    if (filters.source && filters.source.length > 0) {
      conditions.push(inArray(alerts.source, filters.source));
    }

    // AI Status Filter
    if (filters.aiStatus && filters.aiStatus.length > 0) {
        const aiConditions = [];
        if (filters.aiStatus.includes('verified')) {
            aiConditions.push(sql`alerts.ai_analysis->>'classification' = 'TRUE_POSITIVE'`);
        }
        if (filters.aiStatus.includes('blocked')) {
            aiConditions.push(sql`alerts.ai_analysis->'actionTaken'->>'type' = 'BLOCK_IP'`);
        }
        if (filters.aiStatus.includes('pending')) {
           aiConditions.push(or(
               sql`alerts.ai_triage_status = 'pending'`,
               sql`alerts.ai_triage_status IS NULL`
           ));
        }
        if (filters.aiStatus.includes('promoted')) {
            aiConditions.push(sql`alerts.ai_analysis->'promotedCaseId' IS NOT NULL`);
        }
        
        if (aiConditions.length > 0) {
            conditions.push(or(...aiConditions));
        }
    }

    const query = db
      .select()
      .from(alerts)
      .orderBy(desc(alerts.createdAt))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);
    
    // Only add where clause if there are conditions
    const result = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;

    return result;
  }

  // Get alert by ID
  static async getById(id: string, tenantId: string) {
    const [alert] = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.id, id), eq(alerts.tenantId, tenantId)));

    if (!alert) throw new Error('Alert not found');

    // Get correlations
    const correlations = await db
      .select()
      .from(alertCorrelations)
      .where(eq(alertCorrelations.primaryAlertId, id));

    return { ...alert, correlations };
  }

  // Update alert status
  static async updateStatus(alertId: string, tenantId: string, status: string) {
    const [updated] = await db
      .update(alerts)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(alerts.id, alertId),
        eq(alerts.tenantId, tenantId)
      ))
      .returning();

    return updated;
  }

  // Link alert to case
  static async linkToCase(alertId: string, tenantId: string, caseId: string) {
    const [linked] = await db
      .update(alerts)
      .set({ 
        caseId,
        status: 'investigating',
        updatedAt: new Date() 
      })
      .where(and(
        eq(alerts.id, alertId),
        eq(alerts.tenantId, tenantId)
      ))
      .returning();

    return linked;
  }

  // Correlate alert with similar ones
  static async correlate(alertId: string) {
    const [alert] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, alertId));

    if (!alert) return;

    const correlations: Array<{
      alerts: any[];
      reason: string;
      confidence: number;
    }> = [];

    // 1. Time window correlation (within 1 hour)
    const oneHourAgo = new Date(alert.createdAt.getTime() - 3600000);
    const timeMatches = await db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.tenantId, alert.tenantId),
          gte(alerts.createdAt, oneHourAgo),
          lte(alerts.createdAt, alert.createdAt),
          sql`${alerts.id} != ${alertId}`
        )
      )
      .limit(10);

    if (timeMatches.length > 0) {
      correlations.push({
        alerts: timeMatches,
        reason: 'time_window',
        confidence: 0.6,
      });
    }

    // 2. Same severity + source correlation
    const sourceMatches = await db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.tenantId, alert.tenantId),
          eq(alerts.source, alert.source),
          eq(alerts.severity, alert.severity),
          sql`${alerts.id} != ${alertId}`
        )
      )
      .limit(10);

    if (sourceMatches.length > 0) {
      correlations.push({
        alerts: sourceMatches,
        reason: 'same_source_severity',
        confidence: 0.75,
      });
    }

    // Save correlations
    for (const corr of correlations) {
      if (corr.confidence >= 0.6) {
        await db.insert(alertCorrelations).values({
          tenantId: alert.tenantId,
          primaryAlertId: alertId,
          relatedAlertIds: corr.alerts.map(a => a.id),
          reason: corr.reason,
          confidence: corr.confidence.toString(),
        });
      }
    }

    return correlations;
  }

  // Get correlations for an alert
  static async getCorrelations(alertId: string, tenantId: string) {
    const correlationRecords = await db
      .select()
      .from(alertCorrelations)
      .where(
        and(
          eq(alertCorrelations.primaryAlertId, alertId),
          eq(alertCorrelations.tenantId, tenantId)
        )
      );

    // Fetch related alerts
    const results = await Promise.all(
      correlationRecords.map(async (corr) => {
        const relatedIds = corr.relatedAlertIds as string[];
        const relatedAlerts = await db
          .select()
          .from(alerts)
          .where(inArray(alerts.id, relatedIds));

        return {
          ...corr,
          relatedAlerts,
        };
      })
    );

    return results;
  }

  // Get statistics
  static async getStats(tenantId: string) {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        new: sql<number>`count(*) filter (where status = 'new')`,
        reviewing: sql<number>`count(*) filter (where status = 'reviewing')`,
        dismissed: sql<number>`count(*) filter (where status = 'dismissed')`,
        promoted: sql<number>`count(*) filter (where status = 'promoted')`,
      })
      .from(alerts)
      .where(eq(alerts.tenantId, tenantId));

    return stats;
  }

  // Promote alert to case
  static async promoteToCase(alertId: string, tenantId: string, userId: string) {
    const alert = await this.getById(alertId, tenantId);
    
    // Create case from alert
    const [newCase] = await db.insert(cases).values({
      tenantId,
      title: alert.title,
      description: `Promoted from alert: ${alert.description}`,
      severity: alert.severity as any,
      status: 'open',
      assigneeId: userId,
      reporterId: userId,
    }).returning();

    // Link alert to case
    await this.linkToCase(alertId, tenantId, newCase.id);

    // Update alert status to promoted
    await this.updateStatus(alertId, tenantId, 'promoted');

    return { case: newCase, alert };
  }

  // Bulk dismiss alerts
  static async bulkDismiss(alertIds: string[], tenantId: string) {
    const results = await db
      .update(alerts)
      .set({ 
        status: 'dismissed', 
        updatedAt: new Date() 
      })
      .where(and(
        inArray(alerts.id, alertIds),
        eq(alerts.tenantId, tenantId)
      ))
      .returning();

    return {
      success: true,
      count: results.length,
      alerts: results
    };
  }

  // Bulk promote alerts to cases
  static async bulkPromote(alertIds: string[], tenantId: string, userId: string) {
    const results = [];

    for (const alertId of alertIds) {
      try {
        const result = await this.promoteToCase(alertId, tenantId, userId);
        results.push(result);
      } catch (error) {
        console.error(`Failed to promote alert ${alertId}:`, error);
      }
    }

    return {
      success: true,
      count: results.length,
      cases: results.map(r => r.case),
      alerts: results.map(r => r.alert)
    };
  }
}

