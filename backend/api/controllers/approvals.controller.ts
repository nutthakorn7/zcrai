import { Elysia, t } from 'elysia'
import { withAuth } from '../middleware/auth'
import { PlaybookService } from '../core/services/playbook.service'

export const approvalsController = new Elysia({ prefix: '/approvals' })
  .use(withAuth)

  /**
   * List pending playbook execution approvals
   * @route GET /approvals/pending
   * @access Protected - Requires authentication
   * @returns {Object} List of pending approval requests
   * @description Shows playbook steps requiring manual approval before execution
   */
  .get('/pending', async ({ user }: any) => {
    const approvals = await PlaybookService.listPendingApprovals(user.tenantId)
    return { success: true, data: approvals }
  })

  /**
   * Approve or reject playbook execution step
   * @route POST /approvals/:id/decide
   * @access Protected - Requires authentication
   * @param {string} id - Approval request ID
   * @body {string} decision - 'approved' or 'rejected'
   * @body {string} comments - Decision comments (optional)
   * @returns {Object} Updated approval status
   * @description Manual approval gate for sensitive playbook actions
   */
  .post('/:id/decide', async ({ user, params: { id }, body }: any) => {
    const result = await PlaybookService.approveStep(
        user.tenantId, 
        id, 
        user.id, 
        body.decision, 
        body.comments
    )
    return { success: true, data: result }
  }, {
    body: t.Object({
        decision: t.Union([t.Literal('approved'), t.Literal('rejected')]),
        comments: t.Optional(t.String())
    })
  })

  /**
   * List pending playbook input requests
   * @route GET /approvals/pending-inputs
   */
  .get('/pending-inputs', async ({ user }: any) => {
    const inputs = await PlaybookService.listPendingInputs(user.tenantId)
    return { success: true, data: inputs }
  })

  /**
   * Submit input for a playbook step
   * @route POST /approvals/inputs/:id/submit
   */
  .post('/inputs/:id/submit', async ({ user, params: { id }, body }: any) => {
    const result = await PlaybookService.submitInput(
        user.tenantId,
        id,
        user.id,
        body.data
    )
    return { success: true, data: result }
  }, {
    body: t.Object({
        data: t.Any()
    })
  })
