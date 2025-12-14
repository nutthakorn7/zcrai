import { db } from '../../infra/db';
import { auditLogs } from '../../infra/db/schema';
import { eq, and, desc, gte, lte, like, count } from 'drizzle-orm';

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export const AuditLogService = {
  /**
   * List audit logs with filters and pagination
   */
  async list(tenantId: string, filters: AuditLogFilters = {}) {
    const conditions = [eq(auditLogs.tenantId, tenantId)];

    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters.action) {
      conditions.push(like(auditLogs.action, `%${filters.action}%`));
    }
    if (filters.resource) {
      conditions.push(like(auditLogs.resource, `%${filters.resource}%`));
    }
    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(filters.endDate)));
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [data, total] = await Promise.all([
      db.select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      
      db.select({ count: count() })
        .from(auditLogs)
        .where(and(...conditions))
    ]);

    return {
      data,
      total: total[0].count,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total[0].count / limit)
    };
  }
};
