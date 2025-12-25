/**
 * AI Configuration - Centralized thresholds and parameters
 */
export const AI_CONFIG = {
  // Triage Thresholds
  TRIAGE: {
    MODEL: "gemini-2.0-flash",
    AUTO_DISMISS_CONFIDENCE: 90, // Confidence >= 90% and FALSE_POSITIVE -> dismiss
    AUTO_PROMOTE_CONFIDENCE: 85,  // Confidence >= 85% and TRUE_POSITIVE -> promote to case
    AUTO_BLOCK_CONFIDENCE: 95,    // Confidence >= 95% and TRUE_POSITIVE/CRITICAL -> auto-block
    AUTO_ISOLATE_CONFIDENCE: 98,  // Confidence >= 98% and Ransomware/Critical -> auto-isolate
    CORRELATION_WINDOW_HOURS: 4,  // Look back 4 hours for related alerts
    MAX_RAG_RESULTS: 5,           // Max similar alerts to fetch for context
  },

  // Anomaly Detection Thresholds
  ANOMALY: {
    Z_SCORE_THRESHOLD: 3.0,       // Standard deviations for anomaly
    WEIGHTED_ALPHA: 0.1,          // Smoothing factor for exponential weighting
    MIN_HISTORY_POINTS: 5,        // Minimum data points needed for baseline
  },

  // ROI Calculation (Default values)
  ROI: {
    TIME_SAVED_PER_TRIAGE_MINS: 15,
    TIME_SAVED_PER_BLOCK_MINS: 30,
    ANALYST_HOURLY_RATE: 50,
  }
};
