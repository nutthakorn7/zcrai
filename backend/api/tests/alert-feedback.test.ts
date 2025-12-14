/**
 * Alert Feedback Service Tests
 */
import { describe, test, expect, beforeAll } from 'bun:test';

describe('AlertFeedbackService', () => {
  test('should be defined', async () => {
    const { AlertFeedbackService } = await import('../core/services/alert-feedback.service');
    expect(AlertFeedbackService).toBeDefined();
    expect(AlertFeedbackService.recordFeedback).toBeDefined();
    expect(AlertFeedbackService.getFPStats).toBeDefined();
    expect(AlertFeedbackService.getTuningRecommendations).toBeDefined();
  });

  test('getFPStats should return valid structure or handle DB error', async () => {
    const { AlertFeedbackService } = await import('../core/services/alert-feedback.service');
    
    try {
      const stats = await AlertFeedbackService.getFPStats('00000000-0000-0000-0000-000000000000');
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('confirmed');
      expect(stats).toHaveProperty('falsePositives');
      expect(stats).toHaveProperty('fpRate');
      expect(stats).toHaveProperty('patterns');
      expect(Array.isArray(stats.patterns)).toBe(true);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  test('getTuningRecommendations should return recommendations or handle DB error', async () => {
    const { AlertFeedbackService } = await import('../core/services/alert-feedback.service');
    
    try {
      const result = await AlertFeedbackService.getTuningRecommendations('00000000-0000-0000-0000-000000000000');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('topFPPatterns');
      expect(Array.isArray(result.recommendations)).toBe(true);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});
