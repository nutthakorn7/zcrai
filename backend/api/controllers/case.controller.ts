import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { CaseService } from '../core/services/case.service'
import { CreateCaseSchema, UpdateCaseSchema, AddCommentSchema } from '../validators/case.validator'

export const caseController = new Elysia({ prefix: '/cases' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super_secret_dev_key',
      exp: '1h'
    })
  )
  
  // Guard: Verify Token
  .derive(async ({ jwt, cookie: { access_token } }) => {
    if (!access_token.value || typeof access_token.value !== 'string') return { user: null }
    const payload = await jwt.verify(access_token.value)
    return { user: payload }
  })
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
  })

  // ==================== LIST CASES ====================
  .get('/', async ({ user, query }: any) => {
    const cases = await CaseService.list(user.tenantId, query)
    return { success: true, data: cases }
  })

  //CREATE CASE ====================
  .post('/', async ({ user, body }: any) => {
    const newCase = await CaseService.create(user.tenantId, user.id, body)
    return { success: true, data: newCase }
  }, { body: CreateCaseSchema })

  // ==================== GET CASE DETAIL ====================
  .get('/:id', async ({ user, params: { id }, set }: any) => {
    try {
      const caseDetail = await CaseService.getById(user.tenantId, id) // Fixed: tenantId first
      if (!caseDetail) throw new Error('Case not found')
      return { success: true, data: caseDetail }
    } catch (error: any) {
      console.error('Get case detail failed:', error.message, error.stack);
      set.status = 500;
      return { error: 'Failed to get case', details: error.message };
    }
  })

  // ==================== UPDATE CASE ====================
  .put('/:id', async ({ user, params: { id }, body }: any) => {
    const updated = await CaseService.update(user.tenantId, id, user.id, body)
    return { success: true, data: updated }
  }, { body: UpdateCaseSchema })

  // ==================== ADD COMMENT ====================
  .post('/:id/comments', async ({ user, params: { id }, body, set }: any) => {
    try {
      const comment = await CaseService.addComment(user.tenantId, id, user.id, body.content) // Fixed: tenantId first
      return { success: true, data: comment }
    } catch (error: any) {
      console.error('Add comment failed:', error.message, error.stack);
      set.status = 500;
      return { error: 'Failed to add comment', details: error.message };
    }
  }, { body: AddCommentSchema })

  // ==================== UPLOAD ATTACHMENT ====================
  .post('/:id/attachments', async ({ user, params: { id }, body }: any) => {
    // Elysia auto-parses multipart/form-data
    const file = body?.file
    if (!file) {
      throw new Error('No file provided')
    }
    // @ts-ignore
    return await CaseService.addAttachment(user.tenantId, id, user.id, file)
  })
