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
    const user = (context as any).user;
    const days = parseInt((context as any).query?.days || '30');
    const coverage = await MitreService.getCoverage(user.tenantId, days);
    return { success: true, data: coverage };
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
