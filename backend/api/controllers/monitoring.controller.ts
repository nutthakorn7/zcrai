import { Elysia } from 'elysia'
import client from 'prom-client'
import { db } from '../infra/db'
import { sql } from 'drizzle-orm'
import { redis } from '../infra/cache/redis'

// Initialize Prometheus Registry
const register = new client.Registry()

// Add default metrics (CPU, RAM, Event Loop)
client.collectDefaultMetrics({ register, prefix: 'zcrai_backend_' })

// Custom Metrics
const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
})
register.registerMetric(httpRequestDurationMicroseconds)

export const monitoringController = new Elysia()
    // Middleware to track request duration (simplified for individual routes if needed, or global)
    // For global tracking, this should ideally be a global middleware. 
    // For now, we just expose the endpoint.

    /**
     * Liveness Probe
     * @route GET /health
     * @returns {Object} Status 200 OK
     */
    .get('/health', () => ({ status: 'ok', uptime: process.uptime() }))

    /**
     * Readiness Probe
     * @route GET /ready
     * @description Checks DB and Redis connections
     */
    .get('/ready', async ({ set }) => {
        try {
            // Check DB
            await db.execute(sql`SELECT 1`)
            
            // Check Redis
            const redisStatus = await redis.ping()
            if (redisStatus !== 'PONG') throw new Error('Redis PING failed')

            return { 
                status: 'ready', 
                components: {
                    database: 'up',
                    redis: 'up'
                }
            }
        } catch (error: any) {
            set.status = 503
            return {
                status: 'not_ready',
                error: error.message,
                components: {
                    database: 'unknown', // Could refine
                    redis: 'unknown'
                }
            }
        }
    })

    /**
     * Prometheus Metrics
     * @route GET /metrics
     */
    .get('/metrics', async ({ set }) => {
        set.headers['Content-Type'] = register.contentType
        return await register.metrics()
    })
