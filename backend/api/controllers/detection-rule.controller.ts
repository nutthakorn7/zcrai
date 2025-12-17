import { Elysia, t } from 'elysia'
import { DetectionService } from '../core/services/detection.service'
import { db } from '../infra/db'
import { detectionRules } from '../infra/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { withAuth } from '../middleware/auth'

export const detectionRuleController = new Elysia({ prefix: '/detection-rules' })
  .use(withAuth)
  .model({
    rule: t.Object({
      name: t.String(),
      description: t.Optional(t.String()),
      severity: t.Union([t.Literal('critical'), t.Literal('high'), t.Literal('medium'), t.Literal('low')]),
      query: t.String(),
      isEnabled: t.Boolean(),
      runIntervalSeconds: t.Number(),
      actions: t.Optional(t.Object({
        auto_case: t.Optional(t.Boolean()),
        case_title_template: t.Optional(t.String()),
        severity_override: t.Optional(t.String()),
        group_by: t.Optional(t.Array(t.String()))
      })),
      mitreTechnique: t.Optional(t.String())
    })
  })
  
  // List Rules
  .get('/', async ({ user }) => {
    // If user is superadmin (no tenantId), maybe show all? Or just enforced ones?
    // For now, assume tenantId is required.
    if (!user || !user.tenantId) throw new Error('Tenant ID required')

    const rules = await db.select()
      .from(detectionRules)
      .where(eq(detectionRules.tenantId, user.tenantId))
      .orderBy(desc(detectionRules.updatedAt))
      
    return { data: rules }
  })
  
  // Create Rule
  .post('/', async ({ body, user }) => {
    if (!user || !user.tenantId) throw new Error('Tenant ID required')
    
    const [rule] = await db.insert(detectionRules).values({
      ...body,
      tenantId: user.tenantId,
      createdBy: user.userId // user.id in JWT payload is userId
    }).returning()
    
    return { data: rule }
  }, {
    body: 'rule'
  })
  
  // Update Rule
  .patch('/:id', async ({ params: { id }, body, user }) => {
    if (!user || !user.tenantId) throw new Error('Tenant ID required')
    
    // Check permission
    const existing = await db.query.detectionRules.findFirst({
        where: (rules, { eq, and }) => and(eq(rules.id, id), eq(rules.tenantId, user.tenantId))
    })
    
    if (!existing) throw new Error('Rule not found')

    const [updated] = await db.update(detectionRules)
      .set({
        ...body,
        updatedAt: new Date()
      })
      .where(eq(detectionRules.id, id))
      .returning()
      
    return { data: updated }
  }, {
    body: t.Partial(t.Object({
      name: t.String(),
      description: t.String(),
      severity: t.String(),
      query: t.String(),
      isEnabled: t.Boolean(),
      runIntervalSeconds: t.Number(),
      actions: t.Any(),
      mitreTechnique: t.String()
    }))
  })
  
  // Run Rule Manually
  .post('/:id/run', async ({ params: { id }, user }) => {
    if (!user || !user.tenantId) throw new Error('Tenant ID required')
      
    const rule = await db.query.detectionRules.findFirst({
        where: (rules, { eq, and }) => and(eq(rules.id, id), eq(rules.tenantId, user.tenantId))
    })
    
    if (!rule) throw new Error('Rule not found')
    
    // Execute
    await DetectionService.runRule(rule)
    
    return { success: true, message: 'Rule execution started' }
  })
  
  // Delete Rule
  .delete('/:id', async ({ params: { id }, user }) => {
     if (!user || !user.tenantId) throw new Error('Tenant ID required')
      
     await db.delete(detectionRules)
       .where(and(eq(detectionRules.id, id), eq(detectionRules.tenantId, user.tenantId)))
       
     return { success: true }
  })
