import { Elysia, t } from 'elysia'
import { withAuth } from '../middleware/auth'
import { FeedbackService } from '../core/services/feedback.service'

export const feedbackController = new Elysia({ prefix: '/feedback' })
  .use(withAuth)

  /**
   * Submit feedback for an alert analysis
   * @route POST /feedback/:alertId
   */
  .post('/:alertId', async ({ user, params: { alertId }, body }: any) => {
    const feedback = await FeedbackService.submitFeedback({
      alertId,
      userId: user.id,
      feedback: body.feedback,
      reason: body.reason,
      shouldReopen: body.shouldReopen
    })
    return { success: true, data: feedback }
  }, {
    body: t.Object({
      feedback: t.Union([t.Literal('correct'), t.Literal('incorrect')]),
      reason: t.Optional(t.String()),
      shouldReopen: t.Optional(t.Boolean())
    })
  })

  /**
   * Get ROI Stats
   * @route GET /feedback/stats
   * @deprecated Use Dashboard API
   */
  .get('/stats', async ({ user }: any) => {
    // Deprecated for now, moving metrics to dashboard
    return { success: true, data: {} }
  })
