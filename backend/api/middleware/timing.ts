/**
 * Request Timing Middleware
 * Logs slow API requests for performance monitoring
 */
import { Elysia } from 'elysia';

const SLOW_REQUEST_THRESHOLD_MS = 500;

export const timingMiddleware = new Elysia({ name: 'timing' })
  .derive(({ store }) => {
    (store as any).__requestStartTime = Date.now();
    return {};
  })
  .onAfterHandle(({ store, path, request }) => {
    const startTime = (store as any).__requestStartTime;
    if (!startTime) return;
    
    const duration = Date.now() - startTime;
    
    // Always log auth endpoints for debugging
    if (path.includes('/auth/')) {
      console.log(`[Timing] ${request.method} ${path} completed in ${duration}ms`);
    } else if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      console.warn(`[SLOW] ${request.method} ${path} took ${duration}ms`);
    }
  });
