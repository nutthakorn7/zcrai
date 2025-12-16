import { Elysia, t } from 'elysia'
import { withAuth } from '../middleware/auth'
import { PlaybookService } from '../core/services/playbook.service'

export const approvalsController = new Elysia({ prefix: '/approvals' })
  .use(withAuth)

  // ==================== LIST PENDING APPROVALS ====================
  .get('/pending', async ({ user }: any) => {
    const approvals = await PlaybookService.listPendingApprovals(user.tenantId)
    return { success: true, data: approvals }
  })

  // ==================== DECIDE (APPROVE/REJECT) ====================
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
