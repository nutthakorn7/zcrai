import { Elysia, t } from 'elysia'
import { BillingService } from '../core/services/billing.service'
import { withAuth } from '../middleware/auth'

export const billingController = new Elysia({ prefix: '/billing' })
    .use(withAuth)
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
