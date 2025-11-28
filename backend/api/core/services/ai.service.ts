import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { IntegrationService } from './integration.service'

export const AIService = {
  // Stream chat response
  async chatStream(tenantId: string, messages: any[], context?: string) {
    const aiConfig = await IntegrationService.getAIConfig(tenantId)
    
    if (!aiConfig) {
      throw new Error('No AI Provider configured. Please add OpenAI or Claude integration in Settings.')
    }

    const systemPrompt = `
You are zcrAI Security Assistant, an expert Cyber Security Analyst and SOC Engineer.
Your goal is to assist users with security monitoring, threat analysis, and incident response.

Capabilities:
- Analyze security logs and alerts.
- Explain complex security concepts (MITRE ATT&CK, Cyber Kill Chain).
- Suggest remediation steps for threats.
- Write queries or filters for the dashboard.
- Answer in Thai or English as requested (Default to Thai if user speaks Thai).

Constraints:
- Be concise and professional.
- Do not make up facts (hallucinate). If unsure, state that you need more info.
- Use Markdown for formatting (code blocks, lists, bold text).

Current Context:
${context || 'No specific context provided.'}
`

    // ==================== CLAUDE (ANTHROPIC) ====================
    if (aiConfig.provider === 'claude' || aiConfig.provider === 'anthropic') {
      const anthropic = new Anthropic({
        apiKey: aiConfig.apiKey,
      })

      const stream = await anthropic.messages.create({
        model: aiConfig.model || 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        system: systemPrompt,
        stream: true,
      })
      
      return { type: 'anthropic', stream }
    }
    
    // ==================== OPENAI ====================
    else {
      const openai = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseUrl || undefined, // Support Local LLM via OpenAI compatible API
      })

      const stream = await openai.chat.completions.create({
        model: aiConfig.model || process.env.AI_MODEL_NAME || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: true,
        temperature: 0.3,
      })

      return { type: 'openai', stream }
    }
  },

  // Non-streaming chat response (simple version)
  async chat(tenantId: string, messages: any[], context?: string) {
    // ... similar logic for non-streaming if needed
    return "Please use streaming chat."
  }
}
