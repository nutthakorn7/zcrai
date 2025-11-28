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
    credentials: true
  }))
  .use(authController)
  .use(tenantController)
  .use(userController)
  .use(profileController)
  .use(integrationController)
  .use(dashboardController)
  .use(logsController)
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(process.env.PORT || 8000)

console.log(`🦊 zcrAI Backend running at http://localhost:${app.server?.port}`)
