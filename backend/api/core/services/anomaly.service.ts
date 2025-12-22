/**
 * Statistical Anomaly Detection Service
 * Uses Z-score and other statistical methods to detect anomalies
 */

export interface DetectionResult {
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  baseline: number;
  currentValue: number;
  zScore: number;
  standardDeviations: number;
}

export class AnomalyDetectionService {
  
  /**
   * Detect anomalies using Z-score method
   * @param currentValue Current metric value
   * @param historicalData Array of historical values
   * @param threshold Number of standard deviations to consider anomalous (default: 3)
   */
  static detectAnomaly(
    currentValue: number,
    historicalData: number[],
    threshold: number = 3
  ): DetectionResult {
    if (historicalData.length < 2) {
      // Not enough data for statistical analysis
      return {
        isAnomaly: false,
        severity: 'low',
        confidence: 0,
        baseline: currentValue,
        currentValue,
        zScore: 0,
        standardDeviations: 0,
      };
    }

    const mean = this.calculateMean(historicalData);
    const stdDev = this.calculateStandardDeviation(historicalData, mean);
    
    // Handle case where stdDev is 0 (all values are the same)
    if (stdDev === 0) {
      const isAnomaly = currentValue !== mean;
      return {
        isAnomaly,
        severity: isAnomaly ? 'high' : 'low',
        confidence: isAnomaly ? 1.0 : 0,
        baseline: mean,
        currentValue,
        zScore: isAnomaly ? Infinity : 0,
        standardDeviations: isAnomaly ? Infinity : 0,
      };
    }

    const zScore = (currentValue - mean) / stdDev;
    const absZScore = Math.abs(zScore);
    const isAnomaly = absZScore > threshold;

    // Calculate severity based on how many standard deviations away
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (absZScore > 5) severity = 'critical';
    else if (absZScore > 4) severity = 'high';
    else if (absZScore > 3) severity = 'medium';
    else severity = 'low';

    // Confidence: normalize z-score to 0-1 range (capped at 1)
    const confidence = Math.min(1, absZScore / 5);

    return {
      isAnomaly,
      severity,
      confidence: Number(confidence.toFixed(2)),
      baseline: Number(mean.toFixed(2)),
      currentValue,
      zScore: Number(zScore.toFixed(2)),
      standardDeviations: Number(absZScore.toFixed(2)),
    };
  }

  /**
   * Detect volume anomalies (e.g., sudden spike in logs, alerts)
   */
  static async detectVolumeAnomaly(
    entity: 'logs' | 'alerts' | 'cases',
    currentCount: number,
    historicalCounts: number[]
  ): Promise<DetectionResult> {
    return this.detectAnomaly(currentCount, historicalCounts, 3);
  }

  /**
   * Detect rate anomalies (e.g., unusual request rate)
   */
  static detectRateAnomaly(
    currentRate: number,
    historicalRates: number[]
  ): DetectionResult {
    return this.detectAnomaly(currentRate, historicalRates, 2.5);
  }

  /**
   * Detect pattern anomalies with time-based weighting
   * More recent data is weighted higher
   */
  static detectWeightedAnomaly(
    currentValue: number,
    historicalData: number[],
    threshold: number = 3
  ): DetectionResult {
    if (historicalData.length < 2) {
      return this.detectAnomaly(currentValue, historicalData, threshold);
    }

    // Apply exponential weighting (more recent = higher weight)
    const weights = historicalData.map((_, i) => 
      Math.exp(i / historicalData.length)
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    const weightedMean = historicalData.reduce((sum, val, i) => 
      sum + val * weights[i], 0
    ) / totalWeight;

    const weightedVariance = historicalData.reduce((sum, val, i) => 
      sum + weights[i] * Math.pow(val - weightedMean, 2), 0
    ) / totalWeight;

    const weightedStdDev = Math.sqrt(weightedVariance);

    if (weightedStdDev === 0) {
      const isAnomaly = currentValue !== weightedMean;
      return {
        isAnomaly,
        severity: isAnomaly ? 'high' : 'low',
        confidence: isAnomaly ? 1.0 : 0,
        baseline: weightedMean,
        currentValue,
        zScore: isAnomaly ? Infinity : 0,
        standardDeviations: isAnomaly ? Infinity : 0,
      };
    }

    const zScore = (currentValue - weightedMean) / weightedStdDev;
    const absZScore = Math.abs(zScore);
    const isAnomaly = absZScore > threshold;

    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (absZScore > 5) severity = 'critical';
    else if (absZScore > 4) severity = 'high';
    else if (absZScore > 3) severity = 'medium';
    else severity = 'low';

    return {
      isAnomaly,
      severity,
      confidence: Math.min(1, absZScore / 5),
      baseline: Number(weightedMean.toFixed(2)),
      currentValue,
      zScore: Number(zScore.toFixed(2)),
      standardDeviations: Number(absZScore.toFixed(2)),
    };
  }

  /**
   * Calculate mean (average) of an array
   */
  private static calculateMean(data: number[]): number {
    if (data.length === 0) return 0;
    const sum = data.reduce((a, b) => a + b, 0);
    return sum / data.length;
  }

  /**
   * Calculate standard deviation
   */
  private static calculateStandardDeviation(data: number[], mean: number): number {
    if (data.length === 0) return 0;
    const variance = data.reduce((sum, val) => 
      sum + Math.pow(val - mean, 2), 0
    ) / data.length;
    return Math.sqrt(variance);
  }

  /**
   * Detect multiple anomalies in a time series
   * Returns array of indices where anomalies are detected
   */
  static detectTimeSeriesAnomalies(
    timeSeries: number[],
    windowSize: number = 10,
    threshold: number = 3
  ): number[] {
    const anomalyIndices: number[] = [];

    for (let i = windowSize; i < timeSeries.length; i++) {
      const window = timeSeries.slice(i - windowSize, i);
      const result = this.detectAnomaly(timeSeries[i], window, threshold);
      
      if (result.isAnomaly) {
        anomalyIndices.push(i);
      }
    }

    return anomalyIndices;
  }
}
