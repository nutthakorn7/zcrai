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
import { aiController } from './controllers/ai.controller'
import { adminController } from './controllers/admin.controller'
import { SchedulerService } from './core/services/scheduler.service'
import { db } from './infra/db'
import { users, tenants } from './infra/db/schema'
import { eq } from 'drizzle-orm'

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
      await db.update(users)
        .set({ 
          passwordHash,
          tenantId: tenantId // Ensure linked to System Tenant
        })
        .where(eq(users.email, email))
      console.log('✅ Super Admin updated:', email)
    }
  } catch (e: any) {
    console.error('❌ Super Admin seed error:', e.message)
  }
}

// Initialize
seedSuperAdmin()
SchedulerService.init()

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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  .use(authController)
  .use(tenantController)
  .use(userController)
  .use(profileController)
  .use(integrationController)
  .use(dashboardController)
  .use(logsController)
  .use(aiController)
  .use(adminController) // Super Admin routes
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(process.env.PORT || 8000)

console.log(`🦊 zcrAI Backend running at http://localhost:${app.server?.port}`)
