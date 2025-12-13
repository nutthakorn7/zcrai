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
  .get('/', async ({ user, query }) => {
    // @ts-ignore
    return await CaseService.list(user.tenantId, {
      status: query.status as string,
      assigneeId: query.assigneeId as string
    })
  })

  // ==================== CREATE CASE ====================
  .post('/', async ({ user, body }) => {
    // @ts-ignore
    return await CaseService.create(user.tenantId, user.id, body)
  }, { body: CreateCaseSchema })

  // ==================== GET CASE DETAIL ====================
  .get('/:id', async ({ user, params: { id } }) => {
    // @ts-ignore
    return await CaseService.getById(user.tenantId, id)
  })

  // ==================== UPDATE CASE ====================
  .put('/:id', async ({ user, params: { id }, body }) => {
    // @ts-ignore
    return await CaseService.update(user.tenantId, id, user.id, body)
  }, { body: UpdateCaseSchema })

  // ==================== ADD COMMENT ====================
  .post('/:id/comments', async ({ user, params: { id }, body }) => {
    // @ts-ignore
    return await CaseService.addComment(user.tenantId, id, user.id, body.content)
  }, { body: AddCommentSchema })

  // ==================== UPLOAD ATTACHMENT ====================
  .post('/:id/attachments', async ({ user, params: { id }, body }) => {
    // Elysia auto-parses multipart/form-data
    // @ts-ignore
    const file = body?.file
    if (!file) {
      throw new Error('No file provided')
    }
    // @ts-ignore
    return await CaseService.addAttachment(user.tenantId, id, user.id, file)
  })
