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
  
  // ==================== QUERY GENERATION ====================
  .post('/query', async ({ body }: any) => {
    const { prompt } = body;
    if (!prompt) throw Errors.BadRequest('Prompt is required');
    
    const result = await AIService.generateQuery(prompt);
    return { success: true, data: result };
  })

  // ==================== CHAT ====================
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
