import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
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

// ... existing code

app
  // ... existing imports
  .use(cors({
    origin: true, // อนุญาตทุก origin ใน development
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
  .use(logsController)
  .use(caseController)
  .use(alertController)
  .use(observableController)
  .use(notificationController)
  .use(aiController)
  .use(reportController) // PDF report generation
  .use(adminController) // Super Admin routes
import { playbookController } from './controllers/playbook.controller'
import { analyticsController } from './controllers/analytics.controller';
import { realtimeController } from './controllers/realtime.controller';
import { SchedulerService } from './core/services/scheduler.service'
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
  
  // Start enrichment worker
  const enrichmentWorker = new EnrichmentWorker()
  enrichmentWorker.start()
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
  .use(authController)
  .use(tenantController)
  .use(userController)
  .use(profileController)
  .use(integrationController)
  .use(dashboardController)
  .use(playbookController)
  .use(analyticsController)
  .use(realtimeController)
  .use(logsController)
  .use(caseController)
  .use(alertController)
  .use(observableController)
  .use(notificationController)
  .use(aiController)
  .use(adminController) // Super Admin routes
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))

if (import.meta.main) {
  seedSuperAdmin()
  app.listen(process.env.PORT || 8000)
  console.log(`🦊 zcrAI Backend running at http://localhost:${app.server?.port}`)
}

export { app }
