import { Elysia, t } from 'elysia'
import { PlaybookService } from '../core/services/playbook.service'
import { withAuth } from '../middleware/auth'

export const inputsController = new Elysia({ prefix: '/inputs' })
  .use(withAuth)

  /**
   * List pending user inputs for playbook executions
   * @route GET /inputs/pending
   * @access Protected - Requires authentication
   * @returns {Object} List of pending input requests
   * @description Shows playbook steps waiting for user input data
   */
  .get('/pending', async ({ user }: any) => {
    const inputs = await PlaybookService.listPendingInputs(user.tenantId)
    return { success: true, data: inputs }
  })

  /**
   * Submit user input for playbook execution
   * @route POST /inputs/:id/submit
   * @access Protected - Requires authentication
   * @param {string} id - Input request ID
   * @body {any} Input data (any JSON structure)
   * @returns {Object} Success message
   * @description Provides required data to continue playbook execution
   */
  .post('/:id/submit', async ({ user, params: { id }, body }: any) => {
    // body is the raw input data
    await PlaybookService.submitInput(user.tenantId, id, user.userId, body)
    return { success: true, message: 'Input submitted successfully' }
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Any() // Allow any json structure as input
  })
