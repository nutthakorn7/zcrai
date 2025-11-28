import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { authController } from './controllers/auth.controller'

const app = new Elysia()
  .use(swagger())
  .use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }))
  .use(authController)
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(process.env.PORT || 8000)

console.log(`🦊 zcrAI Backend running at http://localhost:${app.server?.port}`)
