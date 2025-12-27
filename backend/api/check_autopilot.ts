import { db } from './infra/db'
import { tenants, soarActions, alerts } from './infra/db/schema'
import { eq } from 'drizzle-orm'

async function checkAutopilotState() {
  console.log('--- Autopilot Diagnostic ---')
  
  // 1. Check Tenants
  const allTenants = await db.select().from(tenants)
  console.log(`Found ${allTenants.length} tenants`)
  allTenants.forEach(t => {
    console.log(`- Tenant: ${t.name} (ID: ${t.id})`)
    console.log(`  Autopilot Enabled: ${t.autopilotMode}`)
    console.log(`  Threshold: ${t.autopilotThreshold}%`)
  })

  // 2. Check Recent Actions
  const recentActions = await db.select().from(soarActions).limit(10)
  console.log(`\nFound ${recentActions.length} recent autonomous actions`)
  recentActions.forEach(a => {
    console.log(`- Action: ${a.actionType} | Target: ${a.target} | Status: ${a.status}`)
  })

  // 3. Check Critical Alerts with AI Analysis
  const criticalAlerts = await db.select().from(alerts).where(eq(alerts.severity, 'critical')).limit(10)
  console.log(`\nFound ${criticalAlerts.length} critical alerts`)
  criticalAlerts.forEach(alt => {
    console.log(`- Alert: ${alt.title} | AI Status: ${alt.aiTriageStatus}`)
    if (alt.aiAnalysis) {
      console.log(`  Analysis: ${JSON.stringify(alt.aiAnalysis)}`)
    }
  })

  process.exit(0)
}

checkAutopilotState().catch(e => {
  console.error(e)
  process.exit(1)
})
