import { Elysia, t } from 'elysia'
import { tenantGuard } from '../middlewares/auth.middleware'
import { AIService } from '../core/services/ai.service'
import { Errors } from '../middleware/error'

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

    // Use synchronous summarize (TODO: Implement proper streaming)
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
