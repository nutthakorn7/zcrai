import { Elysia, t } from 'elysia'
import { MSSPService } from '../core/services/mssp.service'
import { SLAService } from '../core/services/sla.service'
import { superAdminOnly } from '../middlewares/auth.middleware'

export const msspController = new Elysia({ prefix: '/mssp' })
  .use(superAdminOnly) // Strict SuperAdmin check
  
  /**
   * Get global overview of all managed tenants
   * @route GET /mssp/overview
   */
  .get('/overview', async () => {
    return await MSSPService.getGlobalOverview()
  })

  /**
   * Get health status integration matrix for all tenants
   * @route GET /mssp/health-matrix
   */
  .get('/health-matrix', async () => {
    return await MSSPService.getTenantHealthMatrix()
  })

  /**
   * Get SLA Performance ranking across all tenants
   * @route GET /mssp/sla-ranking
   */
  .get('/sla-ranking', async () => {
    return await SLAService.getMSSPPerformanceRanking()
  })

  /**
   * Global IOC Hunt across all managed tenants
   * @route POST /mssp/global-hunt
   */
  .post('/global-hunt', async ({ body }: any) => {
    const { value } = body
    if (!value) throw new Error('Search value is required')
    
    const results = await MSSPService.globalSearch(value)
    return { success: true, data: results }
  }, {
    body: t.Object({
      value: t.String()
    })
  })
