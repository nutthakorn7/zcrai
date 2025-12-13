import { db } from '../../infra/db';
import { alerts, alertCorrelations, cases } from '../../infra/db/schema';
import { eq, and, desc, inArray, sql, or, gte, lte } from 'drizzle-orm';
import { ObservableService } from './observable.service';

export class AlertService {
  // Create new alert
  static async create(data: {
    tenantId: string;
    source: string;
    severity: string;
    title: string;
    description: string;
    rawData?: any;
  }) {
    const [alert] = await db.insert(alerts).values({
      ...data,
      status: 'new',
    }).returning();

    // Auto-extract IOCs from description + rawData
    const textToScan = data.description + (data.rawData ? JSON.stringify(data.rawData) : '');
    await ObservableService.extract(textToScan, data.tenantId, undefined, alert.id);

    // Auto-correlate after creation
    await this.correlate(alert.id);

    return alert;
  }

  // List alerts with filters
  static async list(filters: {
    tenantId: string;
    status?: string[];
    severity?: string[];
    source?: string[];
    limit?: number;
    offset?: number;
  }) {
    const conditions = [eq(alerts.tenantId, filters.tenantId)];

    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(alerts.status, filters.status));
    }

    if (filters.severity && filters.severity.length > 0) {
      conditions.push(inArray(alerts.severity, filters.severity));
    }

    if (filters.source && filters.source.length > 0) {
      conditions.push(inArray(alerts.source, filters.source));
    }

    const result = await db
      .select()
      .from(alerts)
      .where(and(...conditions))
      .orderBy(desc(alerts.createdAt))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);

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

  // Mark as reviewing
  static async review(id: string, tenantId: string, userId: string) {
    const [updated] = await db
      .update(alerts)
      .set({
        status: 'reviewing',
        reviewedBy: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(alerts.id, id), eq(alerts.tenantId, tenantId)))
      .returning();

    return updated;
  }

  // Dismiss alert
  static async dismiss(
    id: string,
    tenantId: string,
    userId: string,
    reason: string
  ) {
    const [updated] = await db
      .update(alerts)
      .set({
        status: 'dismissed',
        reviewedBy: userId,
        reviewedAt: new Date(),
        dismissReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(alerts.id, id), eq(alerts.tenantId, tenantId)))
      .returning();

    return updated;
  }

  // Promote to case
  static async promoteToCase(
    alertId: string,
    tenantId: string,
    userId: string,
    caseData?: {
      title?: string;
      description?: string;
      priority?: string;
    }
  ) {
    const alert = await this.getById(alertId, tenantId);

    // Create case
    const [newCase] = await db.insert(cases).values({
      tenantId,
      title: caseData?.title || alert.title,
      description: caseData?.description || alert.description,
      severity: alert.severity,
      priority: caseData?.priority || 'normal',
      status: 'open',
      reporterId: userId,
    }).returning();

    // Update alert
    await db
      .update(alerts)
      .set({
        status: 'promoted',
        reviewedBy: userId,
        reviewedAt: new Date(),
        promotedCaseId: newCase.id,
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, alertId));

    return { alert, case: newCase };
  }

  // Bulk dismiss
  static async bulkDismiss(
    alertIds: string[],
    tenantId: string,
    userId: string,
    reason: string
  ) {
    const updated = await db
      .update(alerts)
      .set({
        status: 'dismissed',
        reviewedBy: userId,
        reviewedAt: new Date(),
        dismissReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(alerts.id, alertIds),
          eq(alerts.tenantId, tenantId)
        )
      )
      .returning();

    return updated;
  }

  // Bulk promote
  static async bulkPromote(
    alertIds: string[],
    tenantId: string,
    userId: string,
    caseData: {
      title: string;
      description: string;
      priority?: string;
    }
  ) {
    // Get all alerts
    const alertList = await db
      .select()
      .from(alerts)
      .where(
        and(
          inArray(alerts.id, alertIds),
          eq(alerts.tenantId, tenantId)
        )
      );

    if (alertList.length === 0) throw new Error('No alerts found');

    // Determine highest severity
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    const highestSeverity = alertList.reduce((highest, alert) => {
      const currentIndex = severities.indexOf(alert.severity);
      const highestIndex = severities.indexOf(highest);
      return currentIndex < highestIndex ? alert.severity : highest;
    }, 'info');

    // Create single case
    const [newCase] = await db.insert(cases).values({
      tenantId,
      title: caseData.title,
      description: caseData.description,
      severity: highestSeverity,
      priority: caseData.priority || 'normal',
      status: 'open',
      reporterId: userId,
    }).returning();

    // Update all alerts
    await db
      .update(alerts)
      .set({
        status: 'promoted',
        reviewedBy: userId,
        reviewedAt: new Date(),
        promotedCaseId: newCase.id,
        updatedAt: new Date(),
      })
      .where(inArray(alerts.id, alertIds));

    return { alerts: alertList, case: newCase };
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
}
