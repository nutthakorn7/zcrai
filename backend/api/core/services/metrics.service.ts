export class MetricsService {
  private static startTime = Date.now();
  private static requestCount = 0;
  private static responseTimes: number[] = [];

  /**
   * Track API request
   */
  static trackRequest(duration: number) {
    this.requestCount++;
    this.responseTimes.push(duration);
    
    // Keep only last 1000 requests to avoid memory issues
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  /**
   * Get system metrics
   */
  static getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000); // seconds
    const memUsage = process.memoryUsage();
    
    // Calculate percentiles
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avg = sorted.length > 0 
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length 
      : 0;

    return {
      uptime: {
        seconds: uptime,
        formatted: this.formatUptime(uptime)
      },
      requests: {
        total: this.requestCount,
        perSecond: uptime > 0 ? (this.requestCount / uptime).toFixed(2) : '0'
      },
      responseTimes: {
        avg: Math.round(avg),
        p50: Math.round(p50 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100,
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        cpuUsage: process.cpuUsage(),
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format uptime in human-readable format
   */
  private static formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Reset metrics
   */
  static reset() {
    this.requestCount = 0;
    this.responseTimes = [];
    this.startTime = Date.now();
  }
}
