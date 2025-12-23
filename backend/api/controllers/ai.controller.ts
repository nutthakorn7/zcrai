import { Elysia, t } from 'elysia'
import { tenantGuard } from '../middlewares/auth.middleware'
import { AIService } from '../core/services/ai.service'
import { AIFeedbackService } from '../core/services/ai-feedback.service'
import { Errors } from '../middleware/error'
import { Stream } from '@elysiajs/stream'

// Define body schema type
interface ChatBody {
  messages: { role: string; content: string }[]
  context?: string
}

export const aiController = new Elysia({ prefix: '/ai' })
  .use(tenantGuard)
  
  /**
   * Generate ClickHouse query from natural language
   * @route POST /ai/query
   * @access Protected - Requires authentication
   * @body {string} prompt - Natural language query description
   * @returns {Object} Generated ClickHouse SQL query
   * @description Converts natural language to ClickHouse query using AI
   */
  .post('/query', async ({ body }: any) => {
    const { prompt } = body;
    if (!prompt) throw Errors.BadRequest('Prompt is required');
    
    const result = await AIService.generateQuery(prompt);
    return { success: true, data: result };
  })

  /**
   * AI-powered chat assistant for security analysis
   * @route POST /ai/chat
   * @access Protected - Requires authentication
   * @body {array} messages - Chat message history [{role, content}]
   * @body {string} context - Additional context for AI (optional)
   * @returns {Object} AI-generated response
   * @description Security analyst AI assistant for threat analysis and guidance
   */
  .post('/chat', async ({ body, user, cookie: { selected_tenant } }: any) => {
    const { messages, context } = body as ChatBody

    // Use selected_tenant for Super Admin impersonation
    let tenantId = user.tenantId
    if (user.role === 'superadmin' && selected_tenant?.value) {
      tenantId = selected_tenant.value
    }

    console.log(`[AI Chat] Request from Tenant: ${tenantId} (User: ${user.role})`)

    // Use synchronous summarize (Note: Streaming available via GET /chat-stream)
    const lastMessage = messages[messages.length - 1]?.content || ''
    const response = await AIService.summarizeCase({
      title: 'Chat Query',
      description: lastMessage,
      severity: 'info',
      alerts: context ? [{ severity: 'info', title: 'Context', description: context }] : []
    })

    return { 
      success: true, 
      response,
      message: 'AI response generated'
    }
  })

  /**
   * AI Chat Assistant (SSE Streaming)
   * @route GET /ai/chat-stream
   */
  .get('/chat-stream', ({ query, user, cookie: { selected_tenant } }: any) => {
    return new Stream(async (stream) => {
        try {
            const messages = JSON.parse(query.messages || '[]')
            const context = query.context
            
            let tenantId = user.tenantId
            if (user.role === 'superadmin' && selected_tenant?.value) {
                tenantId = selected_tenant.value
            }

            console.log(`[AI Streaming] Starting SSE for Tenant: ${tenantId}`)

            await AIService.streamChat(messages, context, (chunk) => {
                stream.send(chunk)
            })

            stream.close()
        } catch (e: any) {
            stream.send(`Error: ${e.message}`)
            stream.close()
        }
    })
  }, {
    query: t.Object({
        messages: t.String(), // Stringified JSON
        context: t.Optional(t.String())
    })
  })

  /**
   * Get AI Detection Accuracy & ROI Stats
   * @route GET /ai/accuracy
   */
  .get('/accuracy', async ({ user, cookie: { selected_tenant } }: any) => {
    let tenantId = user?.tenantId
    if (user?.role === 'superadmin' && selected_tenant?.value) {
      tenantId = selected_tenant.value
    }

    const stats = await AIFeedbackService.getROIStats(tenantId)
    return { success: true, data: stats }
  })

  /**
   * Submit feedback for an AI triage result
   * @route POST /ai/feedback
   */
  .post('/feedback', async ({ body, user }: any) => {
    const { alertId, rating, comment } = body;
    if (!alertId || rating === undefined) throw Errors.BadRequest('alertId and rating are required');

    const entry = await AIFeedbackService.submitFeedback(user.tenantId, alertId, user.id, { rating, comment });
    return { success: true, data: entry };
  }, {
    body: t.Object({
      alertId: t.String(),
      rating: t.Number(), // 1 for Helpful, 0 for Unhelpful
      comment: t.Optional(t.String())
    })
  })
