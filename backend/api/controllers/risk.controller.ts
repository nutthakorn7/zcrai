/**
 * Risk Controller
 * API routes for predictive risk analysis and scoring
 */

import { Elysia } from 'elysia';
import { tenantGuard } from '../middlewares/auth.middleware';
import { RiskScoreService } from '../core/services/risk-score.service';

export const riskController = new Elysia({ prefix: '/risk' })
  .use(tenantGuard)

  /**
   * Get overall organizational risk score
   * @route GET /risk/score
   * @access Protected - Requires authentication
   * @returns {Object} Risk score (0-100) with breakdown by category
   * @description Calculates composite risk score from multiple security metrics
   */
  .get('/score', async (context) => {
    const user = (context as any).user;
    const riskScore = await RiskScoreService.calculateRiskScore(user.tenantId);
    return { success: true, data: riskScore };
  })

  /**
   * Get risk trend prediction
   * @route GET /risk/prediction
   * @access Protected - Requires authentication
   * @returns {Object} Predicted risk trends (increasing/decreasing/stable)
   * @description Uses ML to predict future risk trajectory
   */
  .get('/prediction', async (context) => {
    const user = (context as any).user;
    const prediction = await RiskScoreService.getTrendPrediction(user.tenantId);
    return { success: true, data: prediction };
  })

  /**
   * Get comprehensive risk analysis with recommendations
   * @route GET /risk/analysis
   * @access Protected - Requires authentication
   * @returns {Object} Full risk analysis with alerts and mitigation recommendations
   * @description Detailed risk assessment with actionable insights
   */
  .get('/analysis', async (context) => {
    const user = (context as any).user;
    const analysis = await RiskScoreService.getRiskAlerts(user.tenantId);
    return { success: true, data: analysis };
  });
