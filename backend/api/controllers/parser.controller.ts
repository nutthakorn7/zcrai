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

  /**
   * List all custom log parsers for tenant
   * @route GET /parsers
   * @access Protected - Requires authentication
   * @returns {Object} List of custom parsers (regex, grok, json_path)
   */
  .get('/', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    const parsers = await ParserService.list(user.tenantId)
    return { success: true, data: parsers }
  })

  /**
   * Get specific parser by ID
   * @route GET /parsers/:id
   * @access Protected - Requires authentication
   * @param {string} id - Parser ID
   * @returns {Object} Parser configuration
   * @throws {404} Parser not found
   */
  .get('/:id', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    const { id } = ctx.params
    const parser = await ParserService.getById(user.tenantId, id)
    if (!parser) throw Errors.NotFound('Parser')
    return { success: true, data: parser }
  })

  /**
   * Create a new custom log parser
   * @route POST /parsers
   * @access Protected - Requires authentication
   * @body {string} name - Parser name
   * @body {string} type - Parser type (regex, grok, json_path)
   * @body {string} pattern - Parsing pattern
   * @body {object} fieldMappings - Field extraction mappings (optional)
   * @returns {Object} Created parser
   */
  .post('/', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    const parser = await ParserService.create(user.tenantId, user.id || '', ctx.body)
    ctx.set.status = HTTP_STATUS.CREATED
    return { success: true, data: parser }
  }, { body: CreateParserSchema })

  /**
   * Update existing parser configuration
   * @route PUT /parsers/:id
   * @access Protected - Requires authentication
   * @param {string} id - Parser ID
   * @body Partial parser fields to update
   * @returns {Object} Updated parser
   * @throws {404} Parser not found
   */
  .put('/:id', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    const parser = await ParserService.update(user.tenantId, ctx.params.id, ctx.body)
    if (!parser) throw Errors.NotFound('Parser')
    return { success: true, data: parser }
  }, { body: UpdateParserSchema })

  /**
   * Delete a custom parser
   * @route DELETE /parsers/:id
   * @access Protected - Requires authentication
   * @param {string} id - Parser ID
   * @returns {Object} Success message
   */
  .delete('/:id', async (ctx) => {
    const user = (ctx as any).user as JWTUserPayload
    await ParserService.delete(user.tenantId, ctx.params.id)
    return { success: true, message: 'Parser deleted' }
  })

  /**
   * Test parser pattern against sample input
   * @route POST /parsers/test
   * @access Protected - Requires authentication
   * @body {string} pattern - Parser pattern to test
   * @body {string} type - Parser type
   * @body {string} testInput - Sample log input
   * @returns {Object} Parsed output/fields
   * @description Test parser without saving - useful for validation
   */
  .post('/test', async ({ body }) => {
    const result = await ParserService.test(body.pattern, body.type, body.testInput)
    return { success: true, data: result }
  }, { body: TestParserSchema })
