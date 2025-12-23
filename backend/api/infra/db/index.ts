import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zcrai'
console.log(`[DB] initializing connection to ${connectionString.replace(/:[^:@]*@/, ':****@')}...`);
const client = postgres(connectionString, {
  max: 20, // Max number of connections
  idle_timeout: 30, // Idle connection timeout in seconds
  connect_timeout: 10, // Connect timeout in seconds
  prepare: false, // Disable prepared statements if using transaction pooling (optional, but safer for simple setups)
})
class QueryLogger {
  logQuery(query: string, params: unknown[]): void {
    // We can't easily time specific queries via the basic logger interface in Drizzle
    // but we can log them. 
    // To measure duration, we might need to wrap the `client` or use Drizzle's `logger: { logQuery }`
    // However, Drizzle's logger is sync and doesn't provide duration.
    // Use `postgres.js` events or `drizzle-orm` logger for debug.
    // For *SLOW* queries, we might need a more advanced setup or middleware.
    // Let's stick to debug logging for now or just trust the Server-Timing 'total' 
    // and drilling down via console logs if needed.
    // Actually, let's keep it simple: Log all queries in Development, warnings in Prod?
    // Let's just enable default logging for now to see what's hitting the DB.
    // console.log(`[DB] ${query}`);
  }
}

export const db = drizzle(client, { 
  schema, 
  logger: process.env.NODE_ENV === 'development' || process.env.DB_LOGGING === 'true' 
})
