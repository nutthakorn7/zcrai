import { Elysia, t } from 'elysia'
import { withAuth } from '../middleware/auth'
import { PlaybookService } from '../core/services/playbook.service'
import { CreatePlaybookSchema, UpdatePlaybookSchema, RunPlaybookSchema, UpdateExecutionStepSchema } from '../validators/playbook.validator'

export const playbookController = new Elysia({ prefix: '/playbooks' })
  .use(withAuth)

  // ==================== LIST PLAYBOOKS ====================
  .get('/', async ({ user }: any) => {
    const playbooks = await PlaybookService.list(user.tenantId)
    return { success: true, data: playbooks }
  })

  // ==================== GET PLAYBOOK ====================
  .get('/:id', async ({ user, params: { id } }: any) => {
    const playbook = await PlaybookService.getById(user.tenantId, id)
    return { success: true, data: playbook }
  })

  // ==================== CREATE PLAYBOOK ====================
  .post('/', async ({ user, body }: any) => {
    const playbook = await PlaybookService.create(user.tenantId, body)
    return { success: true, data: playbook }
  }, { body: CreatePlaybookSchema })

  // ==================== UPDATE PLAYBOOK ====================
  .put('/:id', async ({ user, params: { id }, body }: any) => {
    const playbook = await PlaybookService.update(user.tenantId, id, body)
    return { success: true, data: playbook }
  }, { body: UpdatePlaybookSchema })

  // ==================== DELETE PLAYBOOK ====================
  .delete('/:id', async ({ user, params: { id } }: any) => {
    const result = await PlaybookService.delete(user.tenantId, id)
    return { success: true, data: result }
  })

  // ==================== RUN PLAYBOOK (ON CASE) ====================
  .post('/run', async ({ user, body }: any) => {
    const execution = await PlaybookService.run(user.tenantId, body.caseId, body.playbookId, user.id)
    return { success: true, data: execution }
  }, { body: RunPlaybookSchema })

  // ==================== LIST CASE EXECUTIONS ====================
  .get('/executions', async ({ user, query }: any) => {
    if (!query.caseId) throw new Error('caseId required')
    const executions = await PlaybookService.listExecutions(user.tenantId, query.caseId as string)
    return { success: true, data: executions }
  })

  // ==================== UPDATE EXECUTION STEP ====================
  .put('/executions/:executionId/steps/:stepId', async ({ user, params: { executionId, stepId }, body }: any) => {
    const result = await PlaybookService.updateStepStatus(user.tenantId, executionId, stepId, body.status, body.result)
    return { success: true, data: result }
  }, { body: UpdateExecutionStepSchema })

  // ==================== LIST AVAILABLE ACTIONS ====================
  .get('/actions', async () => {
    // Dynamic import to avoid circular dep issues during init if any
    const { ActionRegistry } = await import('../core/actions/registry');
    return { success: true, data: ActionRegistry.list() }
  })

  // ==================== EXECUTE STEP (AUTOMATION) ====================
  .post('/executions/:executionId/steps/:stepId/execute', async ({ user, params: { executionId, stepId } }: any) => {
    const result = await PlaybookService.executeStep(user.tenantId, executionId, stepId)
    return { success: true, data: result }
  })
