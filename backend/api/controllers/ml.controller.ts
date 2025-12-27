/**
 * ML Controller - Machine Learning & Anomaly Detection
 * API routes for AI-powered anomaly detection and predictive analytics
 */

import { Elysia, t } from 'elysia';
import { withAuth } from '../middleware/auth';
import { AnomalyDetectionService } from '../core/services/anomaly.service';
import { MLAnalyticsService } from '../core/services/ml-analytics.service';

export interface AnomalyMetric {
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
  .use(withAuth)
  
  /**
   * Get real-time ano maly detection for all monitored metrics
   * @route GET /ml/anomalies
   * @access Protected - Requires authentication
   * @returns {Object} Current anomalies with severity, confidence scores, and time series data
   * @description Monitors: Alert Volume, Login Failures, Network Traffic, API Errors, Memory Usage
   */
  .get('/anomalies', async ({ user }: any) => {
    try {
      if (!user?.tenantId) {
        throw new Error('Tenant ID not found in user context');
      }
      
      const [loginStats, alertStats, networkStats, apiErrorStats] = await Promise.all([
        MLAnalyticsService.getLoginFailureStats(user.tenantId),
        MLAnalyticsService.getAlertVolumeStats(user.tenantId),
        MLAnalyticsService.getNetworkTrafficStats(user.tenantId),
        MLAnalyticsService.getApiErrorStats(user.tenantId),
      ]);

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
        {
          name: 'Network Traffic',
          current: networkStats.current,
          historicalAvg: networkStats.average,
          history: networkStats.history,
        },
        {
          name: 'API Errors',
          current: apiErrorStats.current,
          historicalAvg: apiErrorStats.average,
          history: apiErrorStats.history,
        },
        {
          name: 'Memory Usage', // Still mock for now as we don't have OS metrics ingested
          current: 68 + Math.floor(Math.random() * 5),
          historicalAvg: 68,
          history: [65, 67, 68, 70, 66, 69, 71, 68, 67, 70],
        },
      ];

      const anomalies: AnomalyMetric[] = metrics.map(m => {
        const result = AnomalyDetectionService.detectAnomaly(
          m.current,
          m.history
        );
        
        const change = m.historicalAvg > 0 
           ? ((m.current - m.historicalAvg) / m.historicalAvg) * 100
           : (m.current > 0 ? 100 : 0);
        
        return {
          metric: m.name,
          isAnomaly: result.isAnomaly,
          severity: result.severity,
          confidence: result.confidence,
          baseline: Number(m.historicalAvg.toFixed(2)),
          currentValue: Number(m.current.toFixed(2)),
          zScore: result.zScore,
          change: Number(change.toFixed(1)),
        };
      });

      // Generate real time series from the primary metric (Alert Volume history)
      // Since history is daily, and we want 24h view, we'll use a mix of real data and interpolation for now
      // or just show the daily trend points.
      const timeSeries = [];
      const historyPoints = alertStats.history.slice(-24); // Last 24 points
      
      const now = new Date();
      for (let i = 0; i < historyPoints.length; i++) {
        const pointDate = new Date(now);
        pointDate.setDate(pointDate.getDate() - (historyPoints.length - 1 - i));
        
        const value = historyPoints[i];
        const isAnomaly = value > alertStats.average * 2.5; // Simple threshold for visualization
        
        timeSeries.push({
          time: pointDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          value: value,
          isAnomaly: isAnomaly,
          baseline: alertStats.average,
        });
      }

      return {
        success: true,
        anomalies,
        timeSeries: timeSeries.length > 0 ? timeSeries : [],
        summary: {
          total: anomalies.length,
          active: anomalies.filter(a => a.isAnomaly).length,
          critical: anomalies.filter(a => a.severity === 'critical').length,
          high: anomalies.filter(a => a.severity === 'high').length,
        },
      };
    } catch (error: any) {
      console.error('[ML Controller Error]:', error);
      return {
        success: false,
        error: error.message,
        anomalies: [],
        timeSeries: [],
      };
    }
  })

  /**
   * Detect anomaly for a specific custom metric
   * @route POST /ml/detect
   * @access Protected - Requires authentication
   * @body {number} currentValue - Current metric value
   * @body {number[]} historicalData - Historical data points for baseline
   * @body {number} threshold - Z-score threshold (default: 3)
   * @returns {Object} Anomaly detection result with severity and confidence
   * @description Uses statistical Z-score method for outlier detection
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
   * Detect anomalies across time series data
   * @route POST /ml/detect/timeseries
   * @access Protected - Requires authentication
   * @body {number[]} timeSeries - Time series data points
   * @body {number} windowSize - Rolling window size (default: 10)
   * @body {number} threshold - Z-score threshold (default: 3)
   * @returns {Object} Anomaly indices and count
   * @description Identifies all anomalous points within a dataset using rolling statistics
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
