import { Elysia, t } from 'elysia';
import { AuditLogService } from '../core/services/audit.service';
import { tenantGuard } from '../middlewares/auth.middleware';

export const auditController = new Elysia({ prefix: '/audit-logs' })
  .use(tenantGuard)

  // List Audit Logs
  .get('/', async (ctx: any) => {
      const { user, query } = ctx;
      const filters = {
          userId: query.userId,
          action: query.action,
          resource: query.resource,
          startDate: query.startDate,
          endDate: query.endDate,
          limit: query.limit ? parseInt(query.limit) : 50,
          offset: query.offset ? parseInt(query.offset) : 0
      };

      return await AuditLogService.list(user.tenantId, filters);
  }, {
      query: t.Object({
          userId: t.Optional(t.String()),
          action: t.Optional(t.String()),
          resource: t.Optional(t.String()),
          startDate: t.Optional(t.String()),
          endDate: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String())
      })
  });
