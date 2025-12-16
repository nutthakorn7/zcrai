import { Elysia, t } from 'elysia'
import { withAuth, JWTUserPayload } from '../middleware/auth'
import { ParserService } from '../core/services/parser.service'
import { Errors } from '../middleware/error'
import { HTTP_STATUS } from '../config/constants'

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
  .use(withAuth)

  // ==================== LIST PARSERS ====================
  .get('/', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    const parsers = await ParserService.list(user.tenantId)
    return { success: true, data: parsers }
  })

  // ==================== GET PARSER ====================
  .get('/:id', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    const { id } = ctx.params
    const parser = await ParserService.getById(user.tenantId, id)
    if (!parser) throw Errors.NotFound('Parser')
    return { success: true, data: parser }
  })

  // ==================== CREATE PARSER ====================
  .post('/', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    const parser = await ParserService.create(user.tenantId, user.id || '', ctx.body)
    ctx.set.status = HTTP_STATUS.CREATED
    return { success: true, data: parser }
  }, { body: CreateParserSchema })

  // ==================== UPDATE PARSER ====================
  .put('/:id', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    const parser = await ParserService.update(user.tenantId, ctx.params.id, ctx.body)
    if (!parser) throw Errors.NotFound('Parser')
    return { success: true, data: parser }
  }, { body: UpdateParserSchema })

  // ==================== DELETE PARSER ====================
  .delete('/:id', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    await ParserService.delete(user.tenantId, ctx.params.id)
    return { success: true, message: 'Parser deleted' }
  })

  // ==================== TEST PARSER ====================
  .post('/test', async ({ body }) => {
    const result = await ParserService.test(body.pattern, body.type, body.testInput)
    return { success: true, data: result }
  }, { body: TestParserSchema })
