import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { IntegrationService } from '../core/services/integration.service'
import { tenantAdminOnly } from '../middlewares/auth.middleware'
import { AddSentinelOneSchema, AddCrowdStrikeSchema } from '../validators/integration.validator'

export const integrationController = new Elysia({ prefix: '/integrations' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  .use(tenantAdminOnly)

  // ==================== LIST INTEGRATIONS ====================
  .get('/', async ({ jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      return await IntegrationService.list(payload.tenantId as string)
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })

  // ==================== ADD SENTINELONE ====================
  .post('/sentinelone', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const integration = await IntegrationService.addSentinelOne(payload.tenantId as string, body)
      set.status = 201
      return { message: 'SentinelOne integration added successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: AddSentinelOneSchema })

  // ==================== ADD CROWDSTRIKE ====================
  .post('/crowdstrike', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      const integration = await IntegrationService.addCrowdStrike(payload.tenantId as string, body)
      set.status = 201
      return { message: 'CrowdStrike integration added successfully', integration }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  }, { body: AddCrowdStrikeSchema })

  // ==================== DELETE INTEGRATION ====================
  .delete('/:id', async ({ params, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) throw new Error('Unauthorized')

      await IntegrationService.delete(params.id, payload.tenantId as string)
      return { message: 'Integration deleted successfully' }
    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
