import { db } from '../infra/db'
import { apiKeys } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { Encryption } from '../utils/encryption'

const S1_URL = "https://apse1-cyber-defense.sentinelone.net"
const S1_TOKEN = "eyJraWQiOiJhcC1zb3V0aGVhc3QtMS1wcm9kLTAiLCJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJzb2NAY3liZXJkZWZlbnNlLmNvLnRoIiwiaXNzIjoiYXV0aG4tYXAtc291dGhlYXN0LTEtcHJvZCIsImRlcGxveW1lbnRfaWQiOiIyNzQ2IiwidHlwZSI6InVzZXIiLCJleHAiOjE3NjY5NTI5NDQsImlhdCI6MTc2NDM2MDk0NCwianRpIjoiMWRlYmExZTctMDU5Ny00MjA1LWFhMGQtYmQ4OTFmMGY2MjNhIn0.RMVrFn6a_41BZRFSF43FuB9MYLh0-3SfrckIkWAW5yNPCuibht92xWMLggVZ-28Phf3GD0DTpLY95edAqYN_Sw"

// ID found in previous step
const INTEGRATION_ID = "f3f9cf8e-d2a5-4dd1-ad81-21921d0c6076"

async function main() {
  console.log("🔐 Updating SentinelOne credentials...")
  
  // Encrypt with the standard util (uses APP_SECRET from .env)
  const encryptedKey = Encryption.encrypt(JSON.stringify({
      url: S1_URL,
      token: S1_TOKEN,
      fetchSettings: {
        threats: { enabled: true, days: 365 },
        activities: { enabled: true, days: 120 },
        alerts: { enabled: true, days: 365 },
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

  console.log("✅ Credentials updated successfully!")
  process.exit(0)
}

main().catch(err => {
    console.error("❌ Error:", err)
    process.exit(1)
})
