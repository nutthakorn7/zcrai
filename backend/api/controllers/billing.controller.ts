import { Elysia, t } from 'elysia'
import { BillingService } from '../core/services/billing.service'
import { withAuth } from '../middleware/auth'

export const billingController = new Elysia({ prefix: '/billing' })
    .use(withAuth)
    
    /**
     * Get current subscription and usage information
     * @route GET /billing
     * @access Protected - Requires authentication
     * @returns {Object} Subscription tier and current usage metrics
     */
    .get('/', async ({ user }) => {
        if (!user) throw new Error('Unauthorized')
        const sub = await BillingService.getSubscription(user.tenantId)
        const usage = await BillingService.getCurrentUsage(user.tenantId)
        return {
            success: true,
            data: {
                subscription: sub,
                usage
            }
        }
    })
    
    /**
     * Subscribe or upgrade to a different tier
     * @route POST /billing/subscribe
     * @access Protected - Requires authentication
     * @body {string} tier - Subscription tier (free, pro, enterprise)
     * @returns {Object} Success message with new tier
     */
    .post('/subscribe', async ({ user, body }) => {
        if (!user) throw new Error('Unauthorized')
        const { tier } = body
        await BillingService.subscribe(user.tenantId, tier)
        return {
            success: true,
            message: `Upgraded to ${tier}`
        }
    }, {
        body: t.Object({
            tier: t.Union([t.Literal('free'), t.Literal('pro'), t.Literal('enterprise')])
        })
    })
