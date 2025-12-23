import { AsyncLocalStorage } from 'node:async_hooks';

export interface PerformanceMetric {
  name: string;
  startTime: number;
  duration?: number;
  description?: string;
}

export class Profiler {
  private static storage = new AsyncLocalStorage<{
    metrics: PerformanceMetric[];
    startTime: number;
  }>();

  static run<T>(callback: () => T) {
    return this.storage.run({ metrics: [], startTime: performance.now() }, callback);
  }

  static start(name: string, description?: string) {
    const store = this.storage.getStore();
    if (!store) return () => {};

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      description
    };
    store.metrics.push(metric);

    return () => {
      metric.duration = performance.now() - metric.startTime;
    };
  }

  static async record<T>(name: string, fn: () => Promise<T>, description?: string): Promise<T> {
    const end = this.start(name, description);
    try {
      return await fn();
    } finally {
      end();
    }
  }

  // Get Server-Timing header value
  static getHeader(): string {
    const store = this.storage.getStore();
    if (!store) return '';

    // Add total duration
    const totalDuration = performance.now() - store.startTime;
    
    const parts = store.metrics
      .filter(m => m.duration !== undefined)
      .map(m => {
        let val = `${m.name};dur=${m.duration!.toFixed(2)}`;
        if (m.description) val += `;desc="${m.description}"`;
        return val;
      });
    
    parts.push(`total;dur=${totalDuration.toFixed(2)}`);

    return parts.join(', ');
  }
}
