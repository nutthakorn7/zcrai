import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { PlaybookService } from '../core/services/playbook.service'

export const playbookController = new Elysia({ prefix: '/playbooks' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super_secret_dev_key',
      exp: '1h'
    })
  )
  .derive(async ({ jwt, cookie: { access_token } }) => {
    if (!access_token.value || typeof access_token.value !== 'string') return { user: null }
    const payload = await jwt.verify(access_token.value)
    return { user: payload }
  })
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
  })

  // ==================== LIST PLAYBOOKS ====================
  .get('/', async ({ user }) => {
    // @ts-ignore
    return await PlaybookService.list(user.tenantId)
  })

  // ==================== GET PLAYBOOK ====================
  .get('/:id', async ({ user, params: { id } }) => {
    // @ts-ignore
    return await PlaybookService.getById(user.tenantId, id)
  })

  // ==================== CREATE PLAYBOOK ====================
  .post('/', async ({ user, body }) => {
    // @ts-ignore
    return await PlaybookService.create(user.tenantId, body)
  }, {
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.String()),
      triggerType: t.Optional(t.String()),
      targetTag: t.Optional(t.String()),
      steps: t.Optional(t.Array(t.Object({
        name: t.String(),
        type: t.String(), // 'manual', 'automation'
        description: t.Optional(t.String()),
        actionId: t.Optional(t.String()),
        config: t.Optional(t.Any())
      })))
    })
  })

  // ==================== UPDATE PLAYBOOK ====================
  .put('/:id', async ({ user, params: { id }, body }) => {
    // @ts-ignore
    return await PlaybookService.update(user.tenantId, id, body)
  })

  // ==================== DELETE PLAYBOOK ====================
  .delete('/:id', async ({ user, params: { id } }) => {
    // @ts-ignore
    return await PlaybookService.delete(user.tenantId, id)
  })

  // ==================== RUN PLAYBOOK (ON CASE) ====================
  .post('/run', async ({ user, body }) => {
    // @ts-ignore
    return await PlaybookService.run(user.tenantId, body.caseId, body.playbookId, user.id)
  }, {
    body: t.Object({
      caseId: t.String(),
      playbookId: t.String()
    })
  })

  // ==================== LIST CASE EXECUTIONS ====================
  .get('/executions', async ({ user, query }) => {
    if (!query.caseId) throw new Error('caseId required')
    // @ts-ignore
    return await PlaybookService.listExecutions(user.tenantId, query.caseId as string)
  })

  // ==================== UPDATE EXECUTION STEP ====================
  .put('/executions/:executionId/steps/:stepId', async ({ user, params: { executionId, stepId }, body }) => {
    // @ts-ignore
    return await PlaybookService.updateStepStatus(user.tenantId, executionId, stepId, body.status, body.result)
  }, {
    body: t.Object({
      status: t.String(), // 'completed', etc.
      result: t.Optional(t.Any())
    })
  })
