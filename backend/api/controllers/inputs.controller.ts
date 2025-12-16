import { Elysia, t } from 'elysia'
import { PlaybookService } from '../core/services/playbook.service'
import { withAuth } from '../middleware/auth'

export const inputsController = new Elysia({ prefix: '/inputs' })
  .use(withAuth)

  // ==================== LIST PENDING INPUTS ====================
  .get('/pending', async ({ user }: any) => {
    const inputs = await PlaybookService.listPendingInputs(user.tenantId)
    return { success: true, data: inputs }
  })

  // ==================== SUBMIT INPUT ====================
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
