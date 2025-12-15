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

      // Create a native ReadableStream
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            const result = await AIService.chatStream(tenantId, messages, context)
            
            if (result.type === 'anthropic') {
              // Handle Anthropic Stream
              for await (const chunk of result.stream as any) {
                if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
                  controller.enqueue(encoder.encode(chunk.delta.text))
                }
              }
            } else if (result.type === 'gemini') {
              // Handle Gemini Stream
              for await (const chunk of result.stream as any) {
                const text = chunk.text()
                if (text) {
                  controller.enqueue(encoder.encode(text))
                }
              }
            } else {
              // Handle OpenAI Stream
              for await (const chunk of result.stream as any) {
                const content = chunk.choices[0]?.delta?.content || ''
                if (content) {
                  controller.enqueue(encoder.encode(content))
                }
              }
            }
          } catch (error: any) {
            console.error('[AI Chat] Stream Error:', error)
            controller.enqueue(encoder.encode(`\n\n**Error:** ${error.message}`))
          } finally {
            controller.close()
          }
        }
      })

      // Return native Response with streaming
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })

    } catch (e: any) {
      set.status = 400
      return { error: e.message }
    }
  })
