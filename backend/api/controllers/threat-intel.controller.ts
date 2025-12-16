import { Elysia, t } from 'elysia'
import { RetroScanService } from '../core/services/retro-scan.service'
import { withAuth } from '../middleware/auth'

export const threatIntelController = new Elysia({ prefix: '/threat-intel' })
  .use(withAuth)

  // ==================== HISTORICAL RETRO SCAN ====================
  .post('/retro-scan', async ({ user, body }: any) => {
    const { type, value, days } = body
    const result = await RetroScanService.scan(user.tenantId, type, value, days)
    return { success: true, data: result }
  }, {
    body: t.Object({
        type: t.Union([t.Literal('ip'), t.Literal('hash'), t.Literal('domain')]),
        value: t.String(),
        days: t.Optional(t.Number({ default: 90 }))
    })
  })
