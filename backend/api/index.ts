import { Elysia } from 'elysia'
import { registerActions } from './core/actions' // Keep this one
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { rateLimit } from 'elysia-rate-limit'
import { helmet } from 'elysia-helmet'
import { auditLogger } from './middleware/audit'
import { tenantGuard } from './middlewares/auth.middleware'
import { errorHandler } from './middleware/error'
import { timingMiddleware } from './middleware/timing'
import { authController } from './controllers/auth.controller'
import { monitoringController } from './controllers/monitoring.controller'
import { ssoController } from './controllers/sso.controller'
import { passkeyController } from './controllers/passkey.controller'
import { tenantController } from './controllers/tenant.controller'
import { userController } from './controllers/user.controller'
import { profileController } from './controllers/profile.controller'
import { integrationController } from './controllers/integration.controller'
import { dashboardController } from './controllers/dashboard.controller'
import { msspController } from './controllers/mssp.controller'
import { automationController } from './controllers/automation.controller'
import { simulationController } from './controllers/simulation.controller'

registerActions()

import { logsController } from './controllers/logs.controller'
import { caseController } from './controllers/case.controller'
import { alertController } from './controllers/alert.controller'
import { observableController } from './controllers/observable.controller'
import { notificationController } from './controllers/notification.controller'
import { aiController } from './controllers/ai.controller'
import { auditController } from './controllers/audit.controller'
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
import { cloudController } from './controllers/cloud.controller'
import { widgetController } from './controllers/widget.controller'
import { riskController } from './controllers/risk.controller'
import { mitreController } from './controllers/mitre.controller'
import { graphController } from './controllers/graph.controller'
import { threatIntelController } from './controllers/threat-intel.controller'
import { systemController } from './controllers/system.controller'
import { billingController } from './controllers/billing.controller'
import { detectionRuleController } from './controllers/detection-rule.controller'
import { soarController } from './controllers/soar.controller'
import { aiTraceController } from './controllers/ai-trace.controller'
import { SchedulerService } from './core/services/scheduler.service'


import { LogRetentionService } from './core/services/log-retention.service'
import { EnrichmentWorker } from './workers/enrichment.worker'
import { db } from './infra/db'
import { users, tenants } from './infra/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from './utils/password'

// Auto-seed Super Admin on startup (or reset password if exists)
async function seedSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@zcr.ai'
  const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123!'
  
  try {
    const passwordHash = await hashPassword(password)
    
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

// Auto-seed System User (Bot) for automated actions
async function seedSystemUser() {
  const email = 'system@zcr.ai'
  const password = process.env.SYSTEM_USER_PASSWORD || 'SystemBot@Secured!' // Should verify complex pwd
  
  try {
    const passwordHash = await hashPassword(password)
    
    // 1. Get System Tenant
    const [systemTenant] = await db.select().from(tenants).where(eq(tenants.name, 'System Admin'))
    if (!systemTenant) {
      console.warn('⚠️ System Tenant not found during System User seed')
      return
    }

    // 2. Check/Create System User
    const [existing] = await db.select().from(users).where(eq(users.email, email))
    
    if (!existing) {
      await db.insert(users).values({
        email,
        passwordHash,
        role: 'superadmin', // Gives it permission to do anything
        name: 'System Bot',
        tenantId: systemTenant.id,
        status: 'active',
        bio: 'Automated System User for internal actions',
      })
      console.log('🤖 System User (Bot) created:', email)
    } else {
        console.log('🤖 System User exists:', email)
    }
  } catch (e: any) {
    console.error('❌ System User seed error:', e.message)
  }
}

// Initialize
export { seedSuperAdmin, seedSystemUser }

// Don't start background workers during tests (they create Redis connections too early)
import { approvalsController } from './controllers/approvals.controller'
import { inputsController } from './controllers/inputs.controller'
import { feedbackController } from './controllers/feedback.controller'
import { huntingController } from './controllers/hunting.controller'
// import { reportController } from './controllers/report.controller'

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
  .use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
  }))
  .derive(({ cookie, request }) => {
    const url = new URL(request.url);
    if (!url.pathname.includes('health') && !url.pathname.includes('/monitoring')) {
        console.log(`[HTTP] ${request.method} ${url.pathname} | Cookies: ${Object.keys(cookie).join(', ')}`);
    }
    return {};
  })
  .use(errorHandler)  // Global error handler
  .use(timingMiddleware) // Request timing logs
  .use(rateLimit({
     duration: 60000, // 1 minute
     max: 300, // Relaxed global limit (API heavy usage)
     generator: (request, server) => {
       const xForwardedFor = request.headers.get('x-forwarded-for')
       if (xForwardedFor) return xForwardedFor.split(',')[0].trim()
       return server?.requestIP(request)?.address || 'unknown'
     },
  }))
  .use(monitoringController) // Public Monitoring Endpoints
  .use(authController)
  .use(passkeyController)
  .use(ssoController)
  .use(tenantController)
  .use(userController)
  .use(profileController)
  .use(integrationController)
  .use(dashboardController)
  .use(playbookController)
  .use(approvalsController)
  .use(inputsController)
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
  .use(auditController)
  .use(feedbackController)
  .use(huntingController)
  .use(reportController) // PDF report generation
  .use(adminController) // Super Admin routes
  .use(edrController) // EDR response actions
  .use(evidenceController) // Evidence chain-of-custody
  .use(forensicsController) // Memory forensics
  .use(mlController) // ML anomaly detection
  .use(cloudController) // Cloud Integrations (AWS)
  .use(widgetController) // Custom Widget Builder
  .use(riskController) // Predictive Risk Analysis
  .use(mitreController) // MITRE ATT&CK Coverage
  .use(graphController) // Investigation Graph
  .use(threatIntelController) // Threat Intel Feeds & Retro Scan
  .use(systemController) // System Management (Backups, License)
  .use(billingController) // Billing & Subscription
  .use(detectionRuleController) // Detection Rules
  .use(msspController) // MSSP Global Views
  .use(automationController) // AI Autopilot & Autonomous Actions
  .use(simulationController) // Attack Simulation for AI SOC Verification
  .use(soarController) // SOAR readiness & mock actions
  .use(aiTraceController) // AI Trace & Observability
  // .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() })) // Moved to monitoringController

if (import.meta.main) {
  await seedSuperAdmin()
  await seedSystemUser()
  const server = app.listen(process.env.PORT || 8000)
  
  // Register SocketService
  import('./core/services/socket.service').then(({ SocketService }) => {
    SocketService.register(app);
  });

  console.log(` foxes zcrAI Backend running at http://localhost:${(server as any)?.port}`)
}

export { app }
