import { Elysia, t } from 'elysia'
import client from 'prom-client'
import { db } from '../infra/db'
import { sql } from 'drizzle-orm'
import { redis } from '../infra/cache/redis'
import { query } from '../infra/clickhouse/client'

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

    /**
     * Host Metrics (CPU, Memory, Disk, Network)
     * @route GET /metrics/hosts
     * @description Returns host metrics from ClickHouse
     */
    .get('/metrics/hosts', async ({ query: params }) => {
        const timeRange = params.range || '1h'
        const host = params.host || null
        
        // Parse time range
        let intervalMinutes = 60
        if (timeRange === '15m') intervalMinutes = 15
        else if (timeRange === '1h') intervalMinutes = 60
        else if (timeRange === '6h') intervalMinutes = 360
        else if (timeRange === '24h') intervalMinutes = 1440

        // Query aggregated metrics
        const sql = `
            SELECT
                host,
                metric_name,
                toStartOfMinute(timestamp) AS time,
                avg(metric_value) AS avg_value,
                max(metric_value) AS max_value
            FROM host_metrics
            WHERE timestamp > now() - INTERVAL ${intervalMinutes} MINUTE
                ${host ? `AND host = {host:String}` : ''}
            GROUP BY host, metric_name, time
            ORDER BY time DESC
            LIMIT 1000
        `
        
        try {
            const rows = await query<{
                host: string
                metric_name: string
                time: string
                avg_value: number
                max_value: number
            }>(sql, host ? { host } : {})
            
            // Group by metric type for easier frontend consumption
            const grouped = rows.reduce((acc, row) => {
                const key = row.host
                if (!acc[key]) acc[key] = { cpu: [], memory: [], disk: [], network: [] }
                
                if (row.metric_name.includes('cpu')) {
                    acc[key].cpu.push(row)
                } else if (row.metric_name.includes('memory')) {
                    acc[key].memory.push(row)
                } else if (row.metric_name.includes('disk')) {
                    acc[key].disk.push(row)
                } else if (row.metric_name.includes('network')) {
                    acc[key].network.push(row)
                }
                
                return acc
            }, {} as Record<string, { cpu: any[], memory: any[], disk: any[], network: any[] }>)

            return { hosts: grouped }
        } catch (error: any) {
            return { error: error.message, hosts: {} }
        }
    }, {
        query: t.Object({
            range: t.Optional(t.String()),
            host: t.Optional(t.String())
        })
    })

