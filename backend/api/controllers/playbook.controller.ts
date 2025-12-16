import { Elysia, t } from 'elysia'
import { withAuth } from '../middleware/auth'
import { PlaybookService } from '../core/services/playbook.service'
import { CreatePlaybookSchema, UpdatePlaybookSchema, RunPlaybookSchema, UpdateExecutionStepSchema } from '../validators/playbook.validator'

export const playbookController = new Elysia({ prefix: '/playbooks' })
  .use(withAuth)

  /**
   * List all SOAR playbooks for tenant
   * @route GET /playbooks
   * @access Protected - Requires authentication
   * @returns {Object} List of automated response playbooks
   */
  .get('/', async ({ user }: any) => {
    const playbooks = await PlaybookService.list(user.tenantId)
    return { success: true, data: playbooks }
  })

  /**
   * Get detailed playbook configuration
   * @route GET /playbooks/:id
   * @access Protected - Requires authentication
   * @param {string} id - Playbook ID
   * @returns {Object} Playbook with steps and actions
   */
  .get('/:id', async ({ user, params: { id } }: any) => {
    const playbook = await PlaybookService.getById(user.tenantId, id)
    return { success: true, data: playbook }
  })

  /**
   * Create a new automated playbook
   * @route POST /playbooks
   * @access Protected - Requires authentication
   * @body {string} title - Playbook name
   * @body {array} steps - Automation steps
   * @returns {Object} Created playbook
   */
  .post('/', async ({ user, body }: any) => {
    const playbook = await PlaybookService.create(user.tenantId, body)
    return { success: true, data: playbook }
  }, { body: CreatePlaybookSchema })

  /**
   * Update playbook configuration
   * @route PUT /playbooks/:id
   * @access Protected - Requires authentication
   * @param {string} id - Playbook ID
   * @body {string} title - Updated title (optional)
   * @body {array} steps - Updated steps (optional)
   * @returns {Object} Updated playbook
   */
  .put('/:id', async ({ user, params: { id }, body }: any) => {
    const playbook = await PlaybookService.update(user.tenantId, id, body)
    return { success: true, data: playbook }
  }, { body: UpdatePlaybookSchema })

  /**
   * Delete a playbook
   * @route DELETE /playbooks/:id
   * @access Protected - Requires authentication
   * @param {string} id - Playbook ID
   * @returns {Object} Success message
   */
  .delete('/:id', async ({ user, params: { id } }: any) => {
    const result = await PlaybookService.delete(user.tenantId, id)
    return { success: true, data: result }
  })

  /**
   * Execute playbook on a case
   * @route POST /playbooks/run
   * @access Protected - Requires authentication
   * @body {string} caseId - Case to run playbook on
   * @body {string} playbookId - Playbook to execute
   * @returns {Object} Execution instance with progress tracking
   */
  .post('/run', async ({ user, body }: any) => {
    const execution = await PlaybookService.run(user.tenantId, body.caseId, body.playbookId, user.id)
    return { success: true, data: execution }
  }, { body: RunPlaybookSchema })

  /**
   * List playbook executions for a case
   * @route GET /playbooks/executions
   * @access Protected - Requires authentication
   * @query {string} caseId - Case ID to get executions for
   * @returns {Object} List of playbook runs with status
   * @throws {400} caseId is required
   */
  .get('/executions', async ({ user, query }: any) => {
    if (!query.caseId) throw new Error('caseId required')
    const executions = await PlaybookService.listExecutions(user.tenantId, query.caseId as string)
    return { success: true, data: executions }
  })

  /**
   * Update execution step status (manual override)
   * @route PUT /playbooks/executions/:executionId/steps/:stepId
   * @access Protected - Requires authentication
   * @param {string} executionId - Execution instance ID
   * @param {string} stepId - Step ID within execution
   * @body {string} status - New status (success, failed, skipped)
   * @body {object} result - Step execution result
   * @returns {Object} Updated step status
   */
  .put('/executions/:executionId/steps/:stepId', async ({ user, params: { executionId, stepId }, body }: any) => {
    const result = await PlaybookService.updateStepStatus(user.tenantId, executionId, stepId, body.status, body.result)
    return { success: true, data: result }
  }, { body: UpdateExecutionStepSchema })

  /**
   * List available automation actions
   * @route GET /playbooks/actions
   * @access Protected - Requires authentication
   * @returns {Object} Available actions for playbook steps (EDR, enrichment, notifications, etc.)
   */
  .get('/actions', async () => {
    const { ActionRegistry } = await import('../core/actions/registry');
    return { success: true, data: ActionRegistry.list() }
  })

  /**
   * Execute a specific playbook step (automation trigger)
   * @route POST /playbooks/executions/:executionId/steps/:stepId/execute
   * @access Protected - Requires authentication
   * @param {string} executionId - Execution instance ID
   * @param {string} stepId - Step to execute
   * @returns {Object} Step execution result
   */
  .post('/executions/:executionId/steps/:stepId/execute', async ({ user, params: { executionId, stepId } }: any) => {
    const result = await PlaybookService.executeStep(user.tenantId, executionId, stepId)
    return { success: true, data: result }
  })
