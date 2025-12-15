import { db } from '../../infra/db';
import { alerts, cases, caseHistory, caseComments, users } from '../../infra/db/schema';
import { desc, eq, inArray, getTableColumns } from 'drizzle-orm';

export class ActivityService {
  /**
   * Get recent activity feed (Unified Stream)
   * Aggregates: Alerts (AI Actions), Case History, Comments
   */
  static async getRecentActivity(tenantId: string, limit = 20) {
    // 1. Fetch Recent Alerts (Focus on AI Triage/Investigation)
    // We want alerts that have been updated recently, especially those touched by AI
    const recentAlerts = await db.query.alerts.findMany({
        where: (alerts, { eq, and, isNotNull }) => and(
            eq(alerts.tenantId, tenantId),
            isNotNull(alerts.aiAnalysis) // Only show AI active alerts for now to highlight AI? Or all? Let's show all but highlight AI.
        ),
        orderBy: [desc(alerts.updatedAt)],
        limit: limit
    });

    // 2. Fetch Case History (Status changes, Assignments)
    // We need to join with cases to filter by tenant
    const recentHistory = await db
        .select({
            id: caseHistory.id,
            action: caseHistory.action,
            details: caseHistory.details,
            createdAt: caseHistory.createdAt,
            user: {
                email: users.email,
                name: users.name
            },
            case: {
                id: cases.id,
                title: cases.title
            }
        })
        .from(caseHistory)
        .innerJoin(cases, eq(caseHistory.caseId, cases.id))
        .leftJoin(users, eq(caseHistory.userId, users.id))
        .where(eq(cases.tenantId, tenantId))
        .orderBy(desc(caseHistory.createdAt))
        .limit(limit);

    // 3. Fetch Case Comments
    const recentComments = await db
        .select({
            id: caseComments.id,
            content: caseComments.content,
            createdAt: caseComments.createdAt,
            user: {
                email: users.email,
                name: users.name
            },
            case: {
                id: cases.id,
                title: cases.title
            }
        })
        .from(caseComments)
        .innerJoin(cases, eq(caseComments.caseId, cases.id))
        .innerJoin(users, eq(caseComments.userId, users.id))
        .where(eq(cases.tenantId, tenantId))
        .orderBy(desc(caseComments.createdAt))
        .limit(limit);

    // 4. Transform & Merge
    const activities = [
        ...recentAlerts.map(a => {
            const analysis = a.aiAnalysis as any;
            return {
                id: a.id,
                type: 'alert',
                source: 'ai', // Default to AI if it has analysis, or system
                title: a.title,
                description: analysis?.investigationReport 
                    ? 'Automated Investigation Completed' 
                    : (analysis?.classification === 'FALSE_POSITIVE' ? 'Auto-Closed False Positive' : a.description),
                timestamp: a.updatedAt,
                metadata: {
                    severity: a.severity,
                    aiAnalysis: analysis,
                    status: a.status
                }
            };
        }),
        ...recentHistory.map(h => ({
            id: h.id,
            type: 'case_history',
            source: 'user',
            title: `Case: ${h.case.title}`,
            description: `${formatAction(h.action)} by ${h.user?.email || 'System'}`,
            timestamp: h.createdAt,
            metadata: {
                user: h.user,
                action: h.action,
                details: h.details
            }
        })),
        ...recentComments.map(c => ({
            id: c.id,
            type: 'comment',
            source: 'user',
            title: `Comment on ${c.case.title}`,
            description: c.content,
            timestamp: c.createdAt,
            metadata: {
                user: c.user
            }
        }))
    ];

    // 5. Sort & Slice
    return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
  }
}

function formatAction(action: string) {
    switch(action) {
        case 'create': return 'Created new case';
        case 'status_change': return 'Changed status';
        case 'assign': return 'Assigned case';
        default: return action;
    }
}
