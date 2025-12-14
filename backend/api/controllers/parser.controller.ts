import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { ParserService } from '../core/services/parser.service'

const CreateParserSchema = t.Object({
  name: t.String(),
  description: t.Optional(t.String()),
  type: t.Union([t.Literal('regex'), t.Literal('grok'), t.Literal('json_path')]),
  pattern: t.String(),
  fieldMappings: t.Optional(t.Any()),
  testInput: t.Optional(t.String()),
})

const UpdateParserSchema = t.Partial(CreateParserSchema)

const TestParserSchema = t.Object({
  pattern: t.String(),
  type: t.Union([t.Literal('regex'), t.Literal('grok'), t.Literal('json_path')]),
  testInput: t.String(),
})

export const parserController = new Elysia({ prefix: '/parsers' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super_secret_dev_key',
    })
  )

  // Middleware: Extract user from JWT
  .derive(async ({ jwt, cookie: { access_token }, set }) => {
    const payload = await jwt.verify(access_token.value as string) as any
    if (!payload) {
      set.status = 401
      throw new Error('Unauthorized')
    }
    return { user: payload }
  })

  // ==================== LIST PARSERS ====================
  .get('/', async ({ user }) => {
    const parsers = await ParserService.list(user.tenantId)
    return { success: true, data: parsers }
  })

  // ==================== GET PARSER ====================
  .get('/:id', async ({ user, params: { id }, set }) => {
    const parser = await ParserService.getById(user.tenantId, id)
    if (!parser) {
      set.status = 404
      return { success: false, error: 'Parser not found' }
    }
    return { success: true, data: parser }
  })

  // ==================== CREATE PARSER ====================
  .post('/', async ({ user, body, set }) => {
    try {
      const parser = await ParserService.create(user.tenantId, user.id, body)
      set.status = 201
      return { success: true, data: parser }
    } catch (e: any) {
      set.status = 400
      return { success: false, error: e.message }
    }
  }, { body: CreateParserSchema })

  // ==================== UPDATE PARSER ====================
  .put('/:id', async ({ user, params: { id }, body, set }) => {
    try {
      const parser = await ParserService.update(user.tenantId, id, body)
      if (!parser) {
        set.status = 404
        return { success: false, error: 'Parser not found' }
      }
      return { success: true, data: parser }
    } catch (e: any) {
      set.status = 400
      return { success: false, error: e.message }
    }
  }, { body: UpdateParserSchema })

  // ==================== DELETE PARSER ====================
  .delete('/:id', async ({ user, params: { id }, set }) => {
    try {
      await ParserService.delete(user.tenantId, id)
      return { success: true, message: 'Parser deleted' }
    } catch (e: any) {
      set.status = 400
      return { success: false, error: e.message }
    }
  })

  // ==================== TEST PARSER ====================
  .post('/test', async ({ body, set }) => {
    const result = await ParserService.test(body.pattern, body.type, body.testInput)
    return { success: true, data: result }
  }, { body: TestParserSchema })
