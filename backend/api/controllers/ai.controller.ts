import { Elysia, t } from 'elysia'
import { withAuth, JWTUserPayload } from '../middleware/auth'
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
  .use(withAuth)
  
  /**
   * Generate ClickHouse query from natural language
   */
  .post('/query', async ({ body, user }: any) => {
    const { prompt } = body;
    if (!prompt) throw Errors.BadRequest('Prompt is required');
    
    // Explicit tenant check
    const tenantId = user?.tenantId;
    if (!tenantId) throw Errors.Unauthorized('Missing tenant context');

    const result = await AIService.generateQuery(prompt);
    return { success: true, data: result };
  })

  /**
   * Generate full Detection Rule from natural language
   */
  .post('/generate-rule', async ({ body, user }: any) => {
    const { description } = body;
    if (!description) throw Errors.BadRequest('Description is required');
    
    const tenantId = user?.tenantId;
    if (!tenantId) throw Errors.Unauthorized('Missing tenant context');

    const result = await AIService.generateDetectionRule(description);
    return { success: true, data: result };
  })

  /**
   * AI-powered chat assistant for security analysis
   */
  .post('/chat', async ({ body, user, cookie: { selected_tenant }, set }: any) => {
    if (!user) {
      set.status = 401
      return { success: false, message: 'Authentication required' }
    }
    
    const { messages, context } = body as ChatBody

    // Use selected_tenant for Super Admin impersonation
    let tenantId = user.tenantId
    if (user.role === 'superadmin' && selected_tenant?.value) {
      tenantId = selected_tenant.value
    }

    if (!tenantId) {
       console.error('[AI Chat] Error: No TenantId found for user', user.email)
       return { success: false, message: 'Tenant context required' }
    }

    console.log(`[AI Chat] Request from Tenant: ${tenantId} (User: ${user.email || user.id})`)

    try {
      const lastMessage = (messages[messages.length - 1]?.content || '').toLowerCase()
      
      let chatContext = context
      
      // Proactively fetch alerts if query suggests a report/summary and context is empty
      const isReportQuery = lastMessage.includes('report') || 
                           lastMessage.includes('summarize') || 
                           lastMessage.includes('summarise') || 
                           lastMessage.includes('sign') || 
                           lastMessage.includes('health') ||
                           lastMessage.includes('alert');

      if (!chatContext && (isReportQuery || messages.length === 1)) {
        console.log(`[AI Chat] Context empty. Proactively fetching alerts for tenant: ${tenantId}`);
        const { AlertService } = await import('../core/services/alert.service');
        const recentAlerts = await AlertService.list({ 
          tenantId: tenantId, 
          limit: 20,
          status: ['new', 'reviewing']
        });
        
        if (recentAlerts.length > 0) {
          chatContext = `Recent Internal Alerts:\n${recentAlerts.map((a: any) => `- [${a.severity}] ${a.title} (${a.status}): ${a.description}`).join('\n')}`;
        } else {
          chatContext = "No recent active alerts found in the internal system.";
        }
      }

      console.log(`[AI Chat] Calling AIService.generalChat. Context provided: ${!!chatContext}`);
      
      const messageText = await AIService.generalChat(messages, chatContext);

      console.log(`[AI Chat] Response handled.`)

      return { 
        success: true, 
        message: messageText
      }
    } catch (e: any) {
      console.error('[AI Chat] Backend Error:', e.message);
      // Clean error message - remove anything that looks like an API key or internal URL
      const cleanMessage = (e.message || 'AI analysis failed')
        .replace(/AIzaSy[A-Za-z0-9_-]{35}/g, '***KEY_REDACTED***')
        .replace(/https:\/\/generativelanguage\.googleapis\.com\/[^\s]+/g, '[INTERNAL_URL]');

      return { 
        success: false, 
        message: `AI error: ${cleanMessage}` 
      }
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

            const lastMessage = (messages[messages.length - 1]?.content || '').toLowerCase()
            let chatContext = context
            
            const isReportQuery = lastMessage.includes('report') || 
                                 lastMessage.includes('summarize') || 
                                 lastMessage.includes('summarise') || 
                                 lastMessage.includes('sign') || 
                                 lastMessage.includes('health') ||
                                 lastMessage.includes('alert');

            if (!chatContext && (isReportQuery || messages.length === 1)) {
                console.log(`[AI Streaming] Proactively fetching alerts for tenant: ${tenantId}`);
                const { AlertService } = await import('../core/services/alert.service');
                const recentAlerts = await AlertService.list({ 
                    tenantId: tenantId, 
                    limit: 20,
                    status: ['new', 'reviewing']
                });
                
                if (recentAlerts.length > 0) {
                    chatContext = `Recent Internal Alerts:\n${recentAlerts.map((a: any) => `- [${a.severity}] ${a.title} (${a.status}): ${a.description}`).join('\n')}`;
                } else {
                    chatContext = "No recent active alerts found in the internal system.";
                }
            }

            console.log(`[AI Streaming] Starting SSE with internal context: ${!!chatContext}`)

            await AIService.streamChat(messages, chatContext, (chunk) => {
                stream.send(chunk)
            })

            stream.close()
        } catch (e: any) {
            console.error('[AI Streaming] SSE Error:', e.message);
            const cleanMessage = (e.message || 'Streaming failed')
                .replace(/AIzaSy[A-Za-z0-9_-]{35}/g, '***KEY_REDACTED***')
                .replace(/https:\/\/generativelanguage\.googleapis\.com\/[^\s]+/g, '[INTERNAL_URL]');
            
            stream.send(`Error: ${cleanMessage}`)
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
