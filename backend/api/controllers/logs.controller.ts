import { Elysia } from 'elysia'
import { LogsService } from '../core/services/logs.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'
import { Errors } from '../middleware/error'

// Helper: Get effective tenantId (supports superadmin impersonation)
const getEffectiveTenantId = (payload: any, selectedTenant: any): string => {
  if (payload.role === 'superadmin' && selectedTenant?.value) {
    return selectedTenant.value
  }
  if (!payload.tenantId) {
    throw Errors.BadRequest('No tenant selected. Super Admin must select a tenant first.')
  }
  return payload.tenantId as string
}

export const logsController = new Elysia({ prefix: '/logs' })
  .use(tenantAdminOnly)

  /**
   * Get available filter options for logs
   * @route GET /logs/filters
   * @access Protected - Admin only
   * @returns {Object} Available filter values (sources, severities, hosts, users)
   * @description Used to populate filter dropdowns in UI
   */
  .get('/filters', async ({ user, cookie: { selected_tenant } }: any) => {
    const tenantId = getEffectiveTenantId(user, selected_tenant)
    return await LogsService.getFilterOptions(tenantId)
  })

  /**
   * Search and filter security logs
   * @route GET /logs
   * @access Protected - Admin only
   * @query {string} startDate - Start date filter (YYYY-MM-DD)
   * @query {string} endDate - End date filter (YYYY-MM-DD)
   * @query {string} severity - Comma-separated severities
   * @query {string} sources - Comma-separated log sources
   * @query {string} host - Filter by hostname
   * @query {string} user - Filter by username
   * @query {string} search - Free-text search
   * @query {string} eventType - Filter by event type
   * @query {number} page - Page number (default: 1)
   * @query {number} limit - Results per page (max: 100, default: 50)
   * @query {string} sortBy - Sort field (default: timestamp)
   * @query {string} sortOrder - Sort direction (asc/desc, default: desc)
   * @returns {Object} Paginated log entries with total count
   */
  .get('/', async ({ user, cookie: { selected_tenant }, query }: any) => {
    const tenantId = getEffectiveTenantId(user, selected_tenant)

    const filters = {
      startDate: query.startDate as string | undefined,
      endDate: query.endDate as string | undefined,
      severity: query.severity ? (query.severity as string).split(',') : undefined,
      source: query.sources 
        ? (typeof query.sources === 'string' ? query.sources.split(',').filter(Boolean) : query.sources)
        : query.source 
          ? (query.source as string).split(',') 
          : undefined,
      host: query.host as string | undefined,
      user: query.user as string | undefined,
      search: query.search as string | undefined,
      eventType: query.eventType as string | undefined,
      integrationId: query.integration_id as string | undefined,
      accountName: query.account_name as string | undefined,
      siteName: query.site_name as string | undefined,
    }

    const pagination = {
      page: parseInt(query.page as string) || 1,
      limit: Math.min(parseInt(query.limit as string) || 50, 100),
      sortBy: (query.sortBy as string) || 'timestamp',
      sortOrder: ((query.sortOrder as string) || 'desc') as 'asc' | 'desc',
    }

    return await LogsService.list(tenantId, filters, pagination)
  })

  /**
   * Get detailed log entry by ID
   * @route GET /logs/:id
   * @access Protected - Admin only
   * @param {string} id - Log entry ID
   * @returns {Object} Full log entry with all fields
   * @throws {404} Log not found
   */
  .get('/:id', async ({ user, cookie: { selected_tenant }, params }: any) => {
    const tenantId = getEffectiveTenantId(user, selected_tenant)
    const log = await LogsService.getById(tenantId, params.id)
    if (!log) throw Errors.NotFound('Log')
    return log
  })
