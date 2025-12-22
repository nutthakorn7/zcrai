import { Elysia, t } from 'elysia'
import { ThreatHuntService } from '../core/services/threat-hunt.service'
import { withAuth } from '../middleware/auth'

export const huntingController = new Elysia({ prefix: '/hunting' })
  .use(withAuth)
  
  /**
   * Run raw SQL Query
   * @route POST /hunting/query
   */
  .post('/query', async ({ user, body }: any) => {
      // Role check: Only Analyst+ (TODO: Implement granular Permissions)
      if (user.role === 'customer') {
          throw new Error('Unauthorized: Hunting requires analyst privileges')
      }

      const results = await ThreatHuntService.runQuery(user.tenantId, body.query)
      return { success: true, data: results }
  }, {
      body: t.Object({
          query: t.String()
      })
  })

  /**
   * Parse and Run Sigma Rule
   * @route POST /hunting/sigma
   */
  .post('/sigma', async ({ user, body }: any) => {
       if (user.role === 'customer') {
          throw new Error('Unauthorized: Hunting requires analyst privileges')
      }

      const { sql, rule } = await ThreatHuntService.parseSigma(user.tenantId, body.yaml)
      
      let results = []
      if (body.execute) {
          results = await ThreatHuntService.runQuery(user.tenantId, sql)
      }

      return { 
          success: true, 
          data: {
              rule: rule.title,
              generatedSql: sql,
              results
          }
      }
  }, {
      body: t.Object({
          yaml: t.String(),
          execute: t.Optional(t.Boolean())
      })
  })
