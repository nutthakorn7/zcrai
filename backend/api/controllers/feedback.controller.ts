import { Elysia, t } from 'elysia'
import { withAuth } from '../middleware/auth'
import { AIFeedbackService } from '../core/services/ai-feedback.service'

export const feedbackController = new Elysia({ prefix: '/feedback' })
  .use(withAuth)

  /**
   * Submit feedback for an alert analysis
   * @route POST /feedback/:alertId
   */
  .post('/:alertId', async ({ user, params: { alertId }, body }: any) => {
    const feedback = await AIFeedbackService.submitFeedback(
      user.tenantId, 
      alertId, 
      user.id, 
      body
    )
    return { success: true, data: feedback }
  }, {
    body: t.Object({
      rating: t.Integer(), // 1, 0, -1
      comment: t.Optional(t.String())
    })
  })

  /**
   * Get ROI Stats
   * @route GET /feedback/stats
   */
  .get('/stats', async ({ user }: any) => {
    const stats = await AIFeedbackService.getROIStats(user.tenantId)
    return { success: true, data: stats }
  })
