/**
 * MITRE ATT&CK Controller
 */

import { Elysia } from 'elysia';
import { tenantGuard } from '../middlewares/auth.middleware';
import { MitreService } from '../core/services/mitre.service';

export const mitreController = new Elysia({ prefix: '/mitre' })
  .use(tenantGuard)

  /**
   * Get full MITRE ATT&CK coverage
   */
  .get('/coverage', async (context) => {
    try {
      const user = (context as any).user;
      const days = parseInt((context as any).query?.days || '30');
      const coverage = await MitreService.getCoverage(user.tenantId, days);
      return { success: true, data: coverage };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  })

  /**
   * Get MITRE summary stats
   */
  .get('/summary', async (context) => {
    try {
      const user = (context as any).user;
      const days = parseInt((context as any).query?.days || '30');
      const summary = await MitreService.getSummary(user.tenantId, days);
      return { success: true, data: summary };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
