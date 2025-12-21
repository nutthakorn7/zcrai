import { Elysia, t } from 'elysia'
import { RetroScanService } from '../core/services/retro-scan.service'
import { withAuth } from '../middleware/auth'

export const threatIntelController = new Elysia({ prefix: '/threat-intel' })
  .use(withAuth)

  /**
   * Perform historical retro scan for IOCs
   * @route POST /threat-intel/retro-scan
   * @access Protected - Requires authentication
   * @body {string} type - IOC type (ip, hash, domain)
   * @body {string} value - IOC value to search
   * @body {number} days - Number of days to scan back (default: 90)
   * @returns {Object} Historical matches of IOC in past logs
   * @description Retroactively scan logs for newly discovered IOC
   */
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

  /**
   * Lookup an indicator across configured threat intel providers
   * @route POST /threat-intel/lookup
   * @access Protected - Requires authentication
   * @body {string} type - IOC type (ip, hash, domain)
   * @body {string} value - IOC value to lookup
   * @returns {Object} Consolidated threat intelligence report
   */
  .post('/lookup', async ({ user, body }: any) => {
    const { ThreatIntelService } = await import('../core/services/threat-intel.service');
    const { type, value } = body;
    const result = await ThreatIntelService.lookup(value, type);
    return { success: true, data: result };
  }, {
    body: t.Object({
        type: t.Union([t.Literal('ip'), t.Literal('hash'), t.Literal('domain'), t.Literal('url')]),
        value: t.String()
    })
  })
