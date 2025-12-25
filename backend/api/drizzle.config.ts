// @ts-nocheck
// Drizzle-kit config - TypeScript checking disabled for this file
// as drizzle-kit types vary by version
export default {
  dialect: 'postgresql',
  schema: './infra/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zcrai',
  },
}
