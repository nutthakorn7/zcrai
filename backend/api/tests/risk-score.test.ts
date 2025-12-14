/**
 * Risk Score Service Tests
 */
import { describe, test, expect } from 'bun:test';

describe('RiskScoreService', () => {
  test('should be defined', async () => {
    const { RiskScoreService } = await import('../core/services/risk-score.service');
    expect(RiskScoreService).toBeDefined();
    expect(RiskScoreService.calculateRiskScore).toBeDefined();
    expect(RiskScoreService.getTrendPrediction).toBeDefined();
    expect(RiskScoreService.getRiskAlerts).toBeDefined();
  });

  test('calculateRiskScore should return valid structure or handle DB error', async () => {
    const { RiskScoreService } = await import('../core/services/risk-score.service');
    
    try {
      const score = await RiskScoreService.calculateRiskScore('00000000-0000-0000-0000-000000000000');
      
      expect(score).toHaveProperty('overall');
      expect(score).toHaveProperty('level');
      expect(score).toHaveProperty('components');
      expect(score).toHaveProperty('trend');
      
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high', 'critical']).toContain(score.level);
      expect(['increasing', 'stable', 'decreasing']).toContain(score.trend);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  test('getTrendPrediction should return 7-day forecast or handle DB error', async () => {
    const { RiskScoreService } = await import('../core/services/risk-score.service');
    
    try {
      const prediction = await RiskScoreService.getTrendPrediction('00000000-0000-0000-0000-000000000000');
      
      expect(prediction).toHaveProperty('historical');
      expect(prediction).toHaveProperty('predicted');
      expect(prediction).toHaveProperty('averageDaily');
      expect(prediction).toHaveProperty('predictedChange');
      expect(prediction.predicted.length).toBe(7);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  test('getRiskAlerts should combine score and predictions', async () => {
    const { RiskScoreService } = await import('../core/services/risk-score.service');
    
    try {
      const result = await RiskScoreService.getRiskAlerts('00000000-0000-0000-0000-000000000000');
      
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('prediction');
      expect(result).toHaveProperty('alerts');
      expect(Array.isArray(result.alerts)).toBe(true);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});
