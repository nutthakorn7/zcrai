/**
 * ML Controller
 * API routes for Machine Learning anomaly detection
 */

import { Elysia, t } from 'elysia';
import { tenantGuard } from '../middlewares/auth.middleware';
import { AnomalyDetectionService } from '../core/services/anomaly.service';
import { MLAnalyticsService } from '../core/services/ml-analytics.service';

interface AnomalyMetric {
  metric: string;
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  baseline: number;
  currentValue: number;
  zScore: number;
  change: number;
}

export const mlController = new Elysia({ prefix: '/ml' })
  .use(tenantGuard)
  
  /**
   * Get current anomaly status for all metrics
   */
  .get('/anomalies', async (context) => {
    try {
      const user = (context as any).user;
      // Fetch Real Data
      const loginStats = await MLAnalyticsService.getLoginFailureStats(user.tenantId);
      const alertStats = await MLAnalyticsService.getAlertVolumeStats(user.tenantId);

      const metrics = [
        {
          name: 'Alert Volume',
          current: alertStats.current,
          historicalAvg: alertStats.average,
          history: alertStats.history,
        },
        {
          name: 'Login Failures',
          current: loginStats.current,
          historicalAvg: loginStats.average,
          history: loginStats.history,
        },
        // Mocks for unavailable data sources
        {
          name: 'Network Traffic',
          current: 2.4 + Math.random() * 0.4,
          historicalAvg: 2.4,
          history: [2.2, 2.3, 2.4, 2.5, 2.3, 2.4, 2.6, 2.4, 2.3, 2.5],
        },
        {
          name: 'API Errors',
          current: Math.floor(Math.random() * 10) + 18,
          historicalAvg: 5,
          history: [3, 4, 5, 6, 4, 5, 7, 5, 4, 6],
        },
        {
          name: 'Memory Usage',
          current: 68 + Math.floor(Math.random() * 10),
          historicalAvg: 68,
          history: [65, 67, 68, 70, 66, 69, 71, 68, 67, 70],
        },
      ];

      const anomalies: AnomalyMetric[] = metrics.map(m => {
        const result = AnomalyDetectionService.detectAnomaly(
          m.current,
          m.history
        );
        
        const change = ((m.current - m.historicalAvg) / m.historicalAvg) * 100;
        
        return {
          metric: m.name,
          isAnomaly: result.isAnomaly,
          severity: result.severity,
          confidence: result.confidence,
          baseline: m.historicalAvg,
          currentValue: Number(m.current.toFixed(2)),
          zScore: result.zScore,
          change: Number(change.toFixed(1)),
        };
      });

      const now = Date.now();
      const baseline = 150;
      const timeSeries = [];
      
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now - i * 3600000);
        const isSpike = i === 3 || i === 2;
        const value = isSpike 
          ? baseline + Math.random() * 200 + 150 
          : baseline + (Math.random() - 0.5) * 40;
        
        timeSeries.push({
          time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          value: Math.round(value),
          isAnomaly: isSpike,
          baseline,
        });
      }

      return {
        success: true,
        anomalies,
        timeSeries,
        summary: {
          total: anomalies.length,
          active: anomalies.filter(a => a.isAnomaly).length,
          critical: anomalies.filter(a => a.severity === 'critical').length,
          high: anomalies.filter(a => a.severity === 'high').length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        anomalies: [],
        timeSeries: [],
      };
    }
  })

  /**
   * Detect anomaly for specific metric
   */
  .post('/detect', async ({ body }: any) => {
    try {
      const { currentValue, historicalData, threshold } = body;

      const result = AnomalyDetectionService.detectAnomaly(
        currentValue,
        historicalData,
        threshold || 3
      );

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }, {
    body: t.Object({
      currentValue: t.Number(),
      historicalData: t.Array(t.Number()),
      threshold: t.Optional(t.Number()),
    }),
  })

  /**
   * Detect time series anomalies
   */
  .post('/detect/timeseries', async ({ body }: any) => {
    try {
      const { timeSeries, windowSize, threshold } = body;

      const anomalyIndices = AnomalyDetectionService.detectTimeSeriesAnomalies(
        timeSeries,
        windowSize || 10,
        threshold || 3
      );

      return {
        success: true,
        data: {
          anomalyIndices,
          totalPoints: timeSeries.length,
          anomalyCount: anomalyIndices.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }, {
    body: t.Object({
      timeSeries: t.Array(t.Number()),
      windowSize: t.Optional(t.Number()),
      threshold: t.Optional(t.Number()),
    }),
  });
