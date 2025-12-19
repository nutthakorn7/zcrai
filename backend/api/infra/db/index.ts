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
export const db = drizzle(client, { schema })
