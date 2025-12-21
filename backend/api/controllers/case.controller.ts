import { Elysia } from 'elysia'
import { withAuth } from '../middleware/auth'
import { CaseService } from '../core/services/case.service'
import { Errors } from '../middleware/error'
import { CreateCaseSchema, UpdateCaseSchema, AddCommentSchema } from '../validators/case.validator'

export const caseController = new Elysia({ prefix: '/cases' })
  .use(withAuth)

  /**
   * List all cases for the authenticated user's tenant
   * @route GET /cases
   * @access Protected - Requires authentication
   * @query {string} status - Filter by case status (optional)
   * @query {string} severity - Filter by severity level (optional)
   * @returns {Array} List of cases (returns array directly for backward compatibility)
   */
  .get('/', async ({ user, query }: any) => {
    const cases = await CaseService.list(user.tenantId, query)
    return cases  // Return array directly, not wrapped
  })

  /**
   * Create a new security case
   * @route POST /cases
   * @access Protected - Requires authentication
   * @body {string} title - Case title (required)
   * @body {string} description - Case description
   * @body {string} severity - Severity level (critical, high, medium, low)
   * @returns {Object} Newly created case with ID
   */
  .post('/', async ({ user, body }: any) => {
    const newCase = await CaseService.create(user.tenantId, user.id, body)
    return { success: true, data: newCase }
  }, { body: CreateCaseSchema })

  /**
   * Get detailed information about a specific case
   * @route GET /cases/:id
   * @access Protected - Requires authentication
   * @param {string} id - Case ID
   * @returns {Object} Case details including comments, attachments, and history
   * @throws {404} Case not found
   */
  .get('/:id', async ({ user, params: { id } }: any) => {
    const caseDetail = await CaseService.getById(user.tenantId, id)
    if (!caseDetail) throw Errors.NotFound('Case')
    return { success: true, data: caseDetail }
  })

  /**
   * Update case details and status
   * @route PUT /cases/:id
   * @access Protected - Requires authentication
   * @param {string} id - Case ID
   * @body {string} title - Updated title (optional)
   * @body {string} status - Updated status (optional)
   * @body {string} assigneeId - Assign to user ID (optional)
   * @returns {Object} Updated case data
   */
  .put('/:id', async ({ user, params: { id }, body }: any) => {
    const updated = await CaseService.update(user.tenantId, id, user.id, body)
    return { success: true, data: updated }
  }, { body: UpdateCaseSchema })

  /**
   * Add a comment to a case for collaboration
   * @route POST /cases/:id/comments
   * @access Protected - Requires authentication
   * @param {string} id - Case ID
   * @body {string} content - Comment content
   * @returns {Object} Created comment with timestamp and author info
   */
  .post('/:id/comments', async ({ user, params: { id }, body }: any) => {
    const comment = await CaseService.addComment(user.tenantId, id, user.id, body.content)
    return { success: true, data: comment }
  }, { body: AddCommentSchema })

  /**
   * Upload an attachment/evidence file to a case
   * @route POST /cases/:id/attachments
   * @access Protected - Requires authentication
   * @param {string} id - Case ID
   * @body {File} file - File to upload (multipart/form-data)
   * @returns {Object} Attachment metadata including file URL
   * @throws {400} No file provided
   */
  .post('/:id/attachments', async ({ user, params: { id }, body }: any) => {
    const file = body?.file
    if (!file) throw Errors.BadRequest('No file provided')
    
    // @ts-ignore - Elysia file handling
    return await CaseService.addAttachment(user.tenantId, id, user.id, file)
  })

  /**
   * Generate AI-powered case summary using case context
   * @route POST /cases/:id/ai/summarize
   * @access Protected - Requires authentication
   * @param {string} id - Case ID
   * @returns {Object} AI-generated summary and key insights
   * @throws {404} Case not found
   */
  .post('/:id/ai/summarize', async ({ user, params: { id } }: any) => {
    const { AIService } = await import('../core/services/ai.service');
    const caseDetail = await CaseService.getById(user.tenantId, id);
    if (!caseDetail) throw Errors.NotFound('Case');
    
    const summaryData = await AIService.summarizeCase(caseDetail);
    return { success: true, data: summaryData };
  })

  /**
   * Get AI recommendation for best matching playbook
   * @route POST /cases/:id/ai/suggest-playbook
   * @access Protected - Requires authentication
   * @param {string} id - Case ID
   * @returns {Object} Suggested playbook with confidence score and reasoning
   * @throws {404} Case not found
   */
  .post('/:id/ai/suggest-playbook', async ({ user, params: { id } }: any) => {
    const { AIService } = await import('../core/services/ai.service');
    const { PlaybookService } = await import('../core/services/playbook.service');

    const caseDetail = await CaseService.getById(user.tenantId, id);
    if (!caseDetail) throw Errors.NotFound('Case');

    const playbooks = await PlaybookService.list(user.tenantId);
    const activePlaybooks = playbooks.filter((p: any) => p.isActive !== false);

    const suggestion = await AIService.suggestPlaybook(caseDetail, activePlaybooks);
    
    let playbookTitle = null;
    if (suggestion.playbookId) {
        const pb = playbooks.find((p: any) => p.id === suggestion.playbookId);
        if (pb) playbookTitle = pb.title;
    }

    return { success: true, data: { ...suggestion, playbookTitle } };
  })
