/**
 * Request Timing Middleware
 * Logs slow API requests for performance monitoring
 */
import { Elysia } from 'elysia';


const SLOW_REQUEST_THRESHOLD_MS = 500;

export const timingMiddleware = new Elysia({ name: 'timing' })
  .derive(async ({ store }) => {
    // We can't easily wrap the entire request in Profiler.run here because derive/onAfterHandle hooks 
    // run at specific points. 
    // However, Elysia doesn't have a "wrap" middleware pattern easily exposed for context?
    // Wait, we can use `.resolve` or proper plugin pattern? 
    // Actually, for AsyncLocalStorage to work, we need to wrap the handler.
    // In Elysia, we might need to use a slightly different pattern or just accept we might miss strict nesting.
    // But let's try to misuse 'derive' to at least initialize if possible?
    // No, AsyncLocalStorage needs a callback scope.
    
    // Alternative: We manually start a span here and stick it in store, 
    // but that won't give us the "AsyncLocalStorage" benefit (deep tracing).
    
    // Let's rely on standard 'store' injection for now for simple span tracking 
    // and manually mock the Profiler behavior for specific blocks if AsyncLocalStorage is too hard 
    // in this middleware chain structure.
    
    // WAIT: Elysia 1.0+ supports `onRequest` which might allow wrapping?
    // Actually, we can use `aot: false` or similar, but let's stick to simple implementation first:
    // We will use a modified version of Profiler that works with Elysia's Store
    // OR we just use the Profiler in specific services and here we just try to read it.
    
    // Let's try attempting to create a "Scope" if we can.
    // If not, we fall back to simple request attachment.
    
    return {
        _startTime: performance.now()
    };
  })
  .onAfterHandle(({ set, store }) => {
      // Since we can't easily wrap Elysia handlers in ALS without modifying the core app structure
      // (e.g. app.handle = (req) => Profiler.run(() => originalHandle(req))),
      // We will try to rely on the fact that if we use Profiler.record() inside controllers, 
      // they might fail if not wrapped.
      
      // Let's modify index.ts to wrap the whole app execution if needed?
      // Too invasive.
      
      // Let's just use a simpler metric array in the store!
      const duration = performance.now() - (store as any)._startTime;
      if (duration > SLOW_REQUEST_THRESHOLD_MS) {
        console.warn(`[SLOW] Request took ${duration.toFixed(2)}ms`); // Keep legacy log
      }
      
      // Header for total duration
      if (set.headers) {
          set.headers['Server-Timing'] = `total;dur=${duration.toFixed(2)}`;
      }
  });
