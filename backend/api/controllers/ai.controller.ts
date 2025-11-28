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
  .post('/chat', async ({ body, jwt, cookie: { access_token }, set }) => {
    try {
      const payload = await jwt.verify(access_token.value)
      if (!payload) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { messages, context } = body as ChatBody

      console.log(`[AI Chat] Request from Tenant: ${payload.tenantId}`)

      // Create a native ReadableStream
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            const result = await AIService.chatStream(payload.tenantId as string, messages, context)
            
            if (result.type === 'anthropic') {
              // Handle Anthropic Stream
              for await (const chunk of result.stream as any) {
                if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
                  controller.enqueue(encoder.encode(chunk.delta.text))
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
