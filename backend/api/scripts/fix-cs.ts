
import { db } from '../infra/db'
import { apiKeys } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { Encryption } from '../utils/encryption'

const CS_CLIENT_ID = "00ad8d099ad549ec890043c8c27e2069"
const CS_CLIENT_SECRET = "FEl3T8Oy1WLsJxVPBD5426aK0cb9HI7YShoCMgmu"
const CS_BASE_URL = "https://api.us-2.crowdstrike.com"

// ID found in previous step
const INTEGRATION_ID = "cde2a960-abda-49ce-b5ad-3fe25be20bf9"

async function main() {
  console.log("🔐 Updating CrowdStrike credentials...")
  
  // Encrypt with the standard util (uses APP_SECRET from .env)
  const encryptedKey = Encryption.encrypt(JSON.stringify({
      clientId: CS_CLIENT_ID,
      clientSecret: CS_CLIENT_SECRET,
      baseUrl: CS_BASE_URL,
      fetchSettings: {
        detections: { enabled: true, days: 7 },
        hosts: { enabled: true, days: 7 },
        incidents: { enabled: true, days: 7 },
        audit: { enabled: true, days: 7 }
      }
  }))

  await db.update(apiKeys)
    .set({
      encryptedKey,
      lastSyncStatus: 'pending', 
      lastSyncError: null,
      lastSyncAt: new Date()
    })
    .where(eq(apiKeys.id, INTEGRATION_ID))

  console.log("✅ CrowdStrike credentials updated successfully!")
  process.exit(0)
}

main().catch(err => {
    console.error("❌ Error:", err)
    process.exit(1)
})
