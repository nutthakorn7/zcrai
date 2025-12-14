import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { rateLimit } from 'elysia-rate-limit'
import { helmet } from 'elysia-helmet'
import { authController } from './controllers/auth.controller'
import { tenantController } from './controllers/tenant.controller'
import { userController } from './controllers/user.controller'
import { profileController } from './controllers/profile.controller'
import { integrationController } from './controllers/integration.controller'
import { dashboardController } from './controllers/dashboard.controller'
import { logsController } from './controllers/logs.controller'
import { caseController } from './controllers/case.controller'
import { alertController } from './controllers/alert.controller'
import { observableController } from './controllers/observable.controller'
import { notificationController } from './controllers/notification.controller'
import { aiController } from './controllers/ai.controller'
import { adminController } from './controllers/admin.controller'
import { reportController } from './controllers/report.controller'
import { notificationChannelController } from './controllers/notification-channel.controller'
import { playbookController } from './controllers/playbook.controller'
import { analyticsController } from './controllers/analytics.controller'
import { realtimeController } from './controllers/realtime.controller'
import { parserController } from './controllers/parser.controller'
import { edrController } from './controllers/edr.controller'
import { evidenceController } from './controllers/evidence.controller'
import { forensicsController } from './controllers/forensics.controller'
import { mlController } from './controllers/ml.controller'
import { SchedulerService } from './core/services/scheduler.service'
import { LogRetentionService } from './core/services/log-retention.service'
import { EnrichmentWorker } from './workers/enrichment.worker'
import { db } from './infra/db'
import { users, tenants } from './infra/db/schema'
import { eq } from 'drizzle-orm'

// Auto-seed Super Admin on startup (or reset password if exists)
// Auto-seed Super Admin on startup (or reset password if exists)
async function seedSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@zcr.ai'
  const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123!'
  
  try {
    const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 })
    
    // 1. Check/Create System Tenant
    let tenantId: string | undefined
    const [existingTenant] = await db.select().from(tenants).where(eq(tenants.name, 'System Admin'))
    
    if (existingTenant) {
      tenantId = existingTenant.id
    } else {
      const [newTenant] = await db.insert(tenants).values({
        name: 'System Admin',
        status: 'active'
      }).returning()
      tenantId = newTenant.id
    }

    // 2. Check/Create Super Admin User
    const [existing] = await db.select().from(users).where(eq(users.email, email))
    
    if (!existing) {
      await db.insert(users).values({
        email,
        passwordHash,
        role: 'superadmin',
        tenantId: tenantId, // Bind to System Tenant
        status: 'active',
      })
      console.log('✅ Super Admin created:', email, 'in System Tenant')
    } else if (existing.role === 'superadmin') {
      // Don't update password every time to avoid race/hashing issues in tests
      // await db.update(users)
      //   .set({ 
      //     passwordHash,
      //     tenantId: tenantId 
      //   })
      //   .where(eq(users.email, email))
      console.log('✅ Super Admin exists:', email)
    }
  } catch (e: any) {
    console.error('❌ Super Admin seed error:', e.message)
  }
}

// Initialize
export { seedSuperAdmin }

// Don't start background workers during tests (they create Redis connections too early)
if (process.env.NODE_ENV !== 'test') {
  SchedulerService.init()
  LogRetentionService.init()
  
  // Initialize Scheduler
  // The import for SchedulerService is already at the top of the file.
  // The SchedulerService.init() call is already present above.
  // Start enrichment worker
  const enrichmentWorker = new EnrichmentWorker()
  enrichmentWorker.start()

  // Register Built-in Actions (SOAR)
  import('./core/actions/builtin').then(m => m.registerBuiltInActions());
}

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'zcrAI API',
        version: '0.0.1',
        description: 'SOC Dashboard API',
      },
    },
  }))
  .use(cors({
    origin: true, // อนุญาตทุก origin ใน development
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }))
  .use(helmet())
  .use(rateLimit({
     duration: 60000, // 1 minute
     max: 100 // 100 requests per minute
  }))
  .use(authController)
  .use(tenantController)
  .use(userController)
  .use(profileController)
  .use(integrationController)
  .use(dashboardController)
  .use(playbookController)
  .use(analyticsController)
  .use(realtimeController)
  .use(parserController)
  .use(logsController)
  .use(caseController)
  .use(alertController)
  .use(observableController)
  .use(notificationController)
  .use(notificationChannelController) // Slack/Teams notifications
  .use(aiController)
  .use(reportController) // PDF report generation
  .use(adminController) // Super Admin routes
  .use(edrController) // EDR response actions
  .use(evidenceController) // Evidence chain-of-custody
  .use(forensicsController) // Memory forensics
  .use(mlController) // ML anomaly detection
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))

if (import.meta.main) {
  seedSuperAdmin()
  app.listen(process.env.PORT || 8000)
  console.log(`🦊 zcrAI Backend running at http://localhost:${app.server?.port}`)
}

export { app }
