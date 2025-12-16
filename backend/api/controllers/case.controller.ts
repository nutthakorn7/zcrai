import { Elysia } from 'elysia'
import { withAuth } from '../middleware/auth'
import { CaseService } from '../core/services/case.service'
import { Errors } from '../middleware/error'
import { CreateCaseSchema, UpdateCaseSchema, AddCommentSchema } from '../validators/case.validator'

export const caseController = new Elysia({ prefix: '/cases' })
  .use(withAuth)

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
  .get('/:id', async ({ user, params: { id } }: any) => {
    const caseDetail = await CaseService.getById(user.tenantId, id)
    if (!caseDetail) throw Errors.NotFound('Case')
    return { success: true, data: caseDetail }
  })

  // ==================== UPDATE CASE ====================
  .put('/:id', async ({ user, params: { id }, body }: any) => {
    const updated = await CaseService.update(user.tenantId, id, user.id, body)
    return { success: true, data: updated }
  }, { body: UpdateCaseSchema })

  // ==================== ADD COMMENT ====================
  .post('/:id/comments', async ({ user, params: { id }, body }: any) => {
    const comment = await CaseService.addComment(user.tenantId, id, user.id, body.content)
    return { success: true, data: comment }
  }, { body: AddCommentSchema })

  // ==================== UPLOAD ATTACHMENT ====================
  .post('/:id/attachments', async ({ user, params: { id }, body }: any) => {
    const file = body?.file
    if (!file) throw Errors.BadRequest('No file provided')
    
    // @ts-ignore
    return await CaseService.addAttachment(user.tenantId, id, user.id, file)
  })

  // ==================== AI SUMMARIZE ====================
  .post('/:id/ai/summarize', async ({ user, params: { id } }: any) => {
    const { AIService } = await import('../core/services/ai.service');
    const caseDetail = await CaseService.getById(user.tenantId, id);
    if (!caseDetail) throw Errors.NotFound('Case');
    
    const summary = await AIService.summarizeCase(caseDetail);
    return { success: true, data: { summary } };
  })

  // ==================== AI SUGGEST PLAYBOOK ====================
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
