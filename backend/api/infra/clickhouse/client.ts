import { createClient } from '@clickhouse/client'

// สร้าง ClickHouse Client
export const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD !== undefined ? process.env.CLICKHOUSE_PASSWORD : 'clickhouse',
  database: process.env.CLICKHOUSE_DB || 'zcrai',
})

// Helper: Query และ return rows
export async function query<T>(sql: string, params?: Record<string, any>): Promise<T[]> {
  const result = await clickhouse.query({
    query: sql,
    query_params: params,
    format: 'JSONEachRow',
  })
  return await result.json()
}

// Helper: Query single row
export async function queryOne<T>(sql: string, params?: Record<string, any>): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] || null
}
