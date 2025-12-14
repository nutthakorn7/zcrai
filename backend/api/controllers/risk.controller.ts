/**
 * Risk Controller
 * API routes for predictive risk analysis
 */

import { Elysia } from 'elysia';
import { tenantGuard } from '../middlewares/auth.middleware';
import { RiskScoreService } from '../core/services/risk-score.service';

export const riskController = new Elysia({ prefix: '/risk' })
  .use(tenantGuard)

  /**
   * Get overall risk score
   */
  .get('/score', async (context) => {
    try {
      const user = (context as any).user;
      const riskScore = await RiskScoreService.calculateRiskScore(user.tenantId);
      return { success: true, data: riskScore };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  })

  /**
   * Get trend prediction
   */
  .get('/prediction', async (context) => {
    try {
      const user = (context as any).user;
      const prediction = await RiskScoreService.getTrendPrediction(user.tenantId);
      return { success: true, data: prediction };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  })

  /**
   * Get full risk analysis with alerts
   */
  .get('/analysis', async (context) => {
    try {
      const user = (context as any).user;
      const analysis = await RiskScoreService.getRiskAlerts(user.tenantId);
      return { success: true, data: analysis };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
