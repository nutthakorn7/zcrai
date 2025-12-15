/**
 * Threat Intel Controller
 * API endpoints for threat intelligence lookups
 */

import { Elysia, t } from 'elysia';
import { ThreatIntelService } from '../core/services/threat-intel.service';
import { withAuth } from '../middleware/auth';

export const threatIntelController = new Elysia({ prefix: '/threat-intel' })
  .use(withAuth)
  
  // Lookup single indicator
  .post('/lookup', async ({ body }: { body: { indicator: string; type: 'ip' | 'domain' | 'url' | 'hash' } }) => {
    const result = await ThreatIntelService.lookup(body.indicator, body.type);
    return result;
  }, {
    body: t.Object({
      indicator: t.String({ minLength: 1 }),
      type: t.Union([
        t.Literal('ip'),
        t.Literal('domain'),
        t.Literal('url'),
        t.Literal('hash')
      ])
    }),
    detail: {
      tags: ['Threat Intel'],
      summary: 'Lookup an indicator across all threat intel sources'
    }
  })

  // Bulk lookup
  .post('/bulk-lookup', async ({ body }: { body: { indicators: { value: string; type: 'ip' | 'domain' | 'url' | 'hash' }[] } }) => {
    const results = await ThreatIntelService.bulkLookup(body.indicators);
    return { results, total: results.length };
  }, {
    body: t.Object({
      indicators: t.Array(t.Object({
        value: t.String(),
        type: t.Union([
          t.Literal('ip'),
          t.Literal('domain'),
          t.Literal('url'),
          t.Literal('hash')
        ])
      }))
    }),
    detail: {
      tags: ['Threat Intel'],
      summary: 'Bulk lookup multiple indicators'
    }
  })

  // Get summary
  .get('/summary', () => {
    return ThreatIntelService.getSummary();
  }, {
    detail: {
      tags: ['Threat Intel'],
      summary: 'Get threat intel activity summary'
    }
  })

  // Get provider status
  .get('/providers', () => {
    return ThreatIntelService.getProviderStatus();
  }, {
    detail: {
      tags: ['Threat Intel'],
      summary: 'Check which providers are configured'
    }
  })

  // Quick IP lookup
  .get('/ip/:ip', async ({ params }: { params: { ip: string } }) => {
    return await ThreatIntelService.lookup(params.ip, 'ip');
  }, {
    params: t.Object({
      ip: t.String()
    }),
    detail: {
      tags: ['Threat Intel'],
      summary: 'Quick IP address lookup'
    }
  })

  // Quick domain lookup
  .get('/domain/:domain', async ({ params }: { params: { domain: string } }) => {
    return await ThreatIntelService.lookup(params.domain, 'domain');
  }, {
    params: t.Object({
      domain: t.String()
    }),
    detail: {
      tags: ['Threat Intel'],
      summary: 'Quick domain lookup'
    }
  })

  // Quick hash lookup
  .get('/hash/:hash', async ({ params }: { params: { hash: string } }) => {
    return await ThreatIntelService.lookup(params.hash, 'hash');
  }, {
    params: t.Object({
      hash: t.String()
    }),
    detail: {
      tags: ['Threat Intel'],
      summary: 'Quick file hash lookup'
    }
  });
