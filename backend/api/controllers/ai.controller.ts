import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { AIService } from '../core/services/ai.service'

// Define body schema type manually to avoid dependency issues
interface ChatBody {
  messages: { role: string; content: string }[]
  context?: string
}

export const aiController = new Elysia({ prefix: '/ai' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'super_secret_dev_key',
  }))
  
  // ==================== CHAT STREAM ====================
    .post('/query', async ({ body }: any) => {
        const { prompt } = body;
        if (!prompt) throw new Error('Prompt is required');
        
        const result = await AIService.generateQuery(prompt);
        return { success: true, data: result };
    })
  .post('/chat', async ({ body, jwt, cookie: { access_token, selected_tenant }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value as string)
      if (!payload) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { messages, context } = body as ChatBody

      // Use selected_tenant for Super Admin impersonation, otherwise use payload.tenantId
      let tenantId = payload.tenantId as string
      if (payload.role === 'superadmin' && selected_tenant?.value) {
        tenantId = selected_tenant.value as string
      }

      console.log(`[AI Chat] Request from Tenant: ${tenantId} (User: ${payload.role})`)

      // Use synchronous summarize instead of stream for now
      // TODO: Implement proper streaming with AIService.chatStream
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

    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
