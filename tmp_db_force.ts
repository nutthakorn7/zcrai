import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// 🔓 FORCE DB CONNECTION String for Debugging/Fix
const connectionString = 'postgres://postgres:postgres@127.0.0.1:5432/zcrai?sslmode=disable'

console.log('[DB] Connecting to:', connectionString)

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })
