/**
 * MITRE ATT&CK Controller
 * MITRE ATT&CK framework coverage and mapping
 */

import { Elysia } from 'elysia';
import { tenantGuard } from '../middlewares/auth.middleware';
import { MitreService } from '../core/services/mitre.service';

export const mitreController = new Elysia({ prefix: '/mitre' })
  .use(tenantGuard)

  /**
   * Get MITRE ATT&CK coverage matrix
   * @route GET /mitre/coverage
   * @access Protected - Requires authentication
   * @query {number} days - Time range in days (default: 30)
   * @returns {Object} Coverage matrix with tactics, techniques, and detection counts
   * @description Shows which MITRE techniques have been detected
   */
  .get('/coverage', async (context) => {
    console.log('[MitreController] GET /coverage hit')
    try {
      const user = (context as any).user;
      console.log('[MitreController] User:', user.email, 'Tenant:', user.tenantId)
      
      let days = parseInt((context as any).query?.days || '30');
      if (isNaN(days) || days <= 0) days = 30;
      
      if (!user.tenantId && user.role !== 'superadmin') {
          throw new Error('Tenant ID missing for non-superadmin')
      }
      
      // Handle superadmin without tenant (if any)
      const tenantId = user.tenantId || (user.role === 'superadmin' ? 'c8abd753-3015-4508-aa7b-6bcf732934e5' : '')
      
      console.log('[MitreController] Fetching coverage for tenant:', tenantId, 'Days:', days)
      const coverage = await MitreService.getCoverage(tenantId, days);
      console.log('[MitreController] Coverage result count:', coverage.length)
      
      return { success: true, data: coverage };
    } catch (err: any) {
      console.error('[MitreController] Error in getCoverage:', err)
      throw err;
    }
  })

  /**
   * Get MITRE summary statistics
   * @route GET /mitre/summary
   * @access Protected - Requires authentication
   * @query {number} days - Time range in days (default: 30)
   * @returns {Object} Summary stats (top tactics, techniques, coverage %)
   * @description Aggregated MITRE statistics for dashboards
   */
  .get('/summary', async (context) => {
    const user = (context as any).user;
    const days = parseInt((context as any).query?.days || '30');
    const summary = await MitreService.getSummary(user.tenantId, days);
    return { success: true, data: summary };
  });
