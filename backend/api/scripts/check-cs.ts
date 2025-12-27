
import { db } from '../infra/db'
import { apiKeys } from '../infra/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const keys = await db.select().from(apiKeys).where(eq(apiKeys.provider, 'crowdstrike'))
  console.log(JSON.stringify(keys, null, 2))
  process.exit(0)
}

main()
