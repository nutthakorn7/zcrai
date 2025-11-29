import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { IntegrationService } from './integration.service'
import { LogsService } from './logs.service'
import { DashboardService } from './dashboard.service'

// Define Tools
const TOOLS_DEF = [
  {
    name: "search_logs",
    description: "Search security logs database. Use this to find specific events, IPs, users, or filenames.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword" },
        limit: { type: "number", description: "Limit results (default 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_dashboard_stats",
    description: "Get security statistics summary (counts by severity).",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days to look back (default 7)" }
      }
    }
  },
  {
    name: "get_top_threats",
    description: "Get top affected hosts and users.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days to look back (default 7)" },
        type: { type: "string", enum: ["host", "user"], description: "Target entity type" }
      },
      required: ["type"]
    }
  },
  {
    name: "get_integrations",
    description: "Get list of active integrations (Security Tools & AI Providers). Use this when user asks 'what integrations do I have?' or 'check connection status'.",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_mitre_techniques",
    description: "Get MITRE ATT&CK techniques and tactics from security events. Use this when user asks about MITRE, attack techniques, TTPs, or threat analysis.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days to look back (default 30)" }
      }
    }
  }
];

export const AIService = {
  // Helper to execute tools
  async executeTool(name: string, args: any, tenantId: string): Promise<string> {
    console.log(`[AI Tool] Executing ${name} with args:`, args);
    try {
      if (name === 'search_logs') {
        const result = await LogsService.list(tenantId, {
          search: args.query
        }, {
          page: 1,
          limit: args.limit || 5
        });
        return JSON.stringify(result.data.map(l => ({
          time: l.timestamp,
          sev: l.severity,
          type: l.event_type,
          title: l.title,
          src: l.source,
          host: l.host_name,
          user: l.user_name
        })));
      }
      
      if (name === 'get_dashboard_stats') {
        const stats = await DashboardService.getSummary(tenantId, args.days || 7);
        return JSON.stringify(stats);
      }

      if (name === 'get_top_threats') {
        console.log(`[AI Tool] get_top_threats args:`, JSON.stringify(args));
        // Default to 'user' if type not specified, or check for user-related keywords
        const targetType = args.type || 'user';
        if (targetType === 'user') {
          const users = await DashboardService.getTopUsers(tenantId, args.days || 7, 5);
          console.log(`[AI Tool] Top Users result:`, JSON.stringify(users));
          return JSON.stringify(users);
        } else {
          const hosts = await DashboardService.getTopHosts(tenantId, args.days || 7, 5);
          console.log(`[AI Tool] Top Hosts result:`, JSON.stringify(hosts));
          return JSON.stringify(hosts);
        }
      }
      
      if (name === 'get_integrations') {
        const integrations = await IntegrationService.list(tenantId);
        return JSON.stringify(integrations.map(i => ({
          provider: i.provider,
          label: i.label,
          status: i.lastSyncStatus,
          lastSync: i.lastSyncAt
        })));
      }

      if (name === 'get_mitre_techniques') {
        const mitre = await DashboardService.getMitreHeatmap(tenantId, args.days || 30);
        console.log(`[AI Tool] MITRE result:`, JSON.stringify(mitre));
        return JSON.stringify(mitre);
      }

      return "Tool not found.";
    } catch (e: any) {
      console.error(`[AI Tool] Error executing ${name}:`, e);
      return `Error executing tool: ${e.message}`;
    }
  },

  // Stream chat response with Tool Support
  async chatStream(tenantId: string, messages: any[], context?: string) {
    const aiConfig = await IntegrationService.getAIConfig(tenantId)
    
    if (!aiConfig) {
      throw new Error('No AI Provider configured. Please add OpenAI or Claude or Gemini integration in Settings.')
    }

    // Sanitize messages: Extract only text content, remove tool-related content
    const sanitizeMessages = (msgs: any[]): Array<{role: 'user' | 'assistant', content: string}> => {
      return msgs.map(m => {
        let content = m.content;
        // If content is an array (Claude format), extract text only
        if (Array.isArray(content)) {
          const textParts = content.filter((c: any) => c.type === 'text');
          content = textParts.map((c: any) => c.text).join('\n') || '';
        }
        // If content is object with text property
        if (typeof content === 'object' && content !== null && 'text' in content) {
          content = content.text;
        }
        return {
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: String(content || '')
        };
      }).filter(m => m.content.trim() !== ''); // Remove empty messages
    };

    const cleanMessages = sanitizeMessages(messages);

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

      // Step 1: Call AI to decide if tool is needed (Non-streaming for tool decision)
      const response = await anthropic.messages.create({
        model: aiConfig.model || 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: cleanMessages,
        system: systemPrompt,
        tools: TOOLS_DEF as any,
        stream: false, // False first to check for tool use
      })

      // Step 2: Check for tool use
      if (response.stop_reason === 'tool_use') {
        const toolUse = response.content.find(c => c.type === 'tool_use');
        if (toolUse && toolUse.type === 'tool_use') {
          // Execute Tool
          const toolResult = await this.executeTool(toolUse.name, toolUse.input, tenantId);
          
          // Prepare messages for second turn (include tool use and result)
          const newMessages = [
            ...cleanMessages,
            { role: 'assistant', content: response.content },
            { 
              role: 'user', 
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: toolResult
                }
              ]
            }
          ];

          // Step 3: Stream Final Response
          const stream = await anthropic.messages.create({
            model: aiConfig.model || 'claude-sonnet-4-5',
            max_tokens: 4096,
            messages: newMessages as any,
            system: systemPrompt,
            tools: TOOLS_DEF as any,
            stream: true,
          });
          
          return { type: 'anthropic', stream };
        }
      }

      // If no tool use, we need to stream the original response content.
      // Since we already consumed it (non-stream), we can't just "return stream".
      // We have to re-create a stream or just stream the text we got.
      // For simplicity, let's just re-call with stream: true if no tool use (costly but simple)
      // OR create a fake stream from the text.
      
      // Better approach: Re-call with stream: true (since we can't easily create a compatible stream object manually without hacks)
      const stream = await anthropic.messages.create({
        model: aiConfig.model || 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: cleanMessages,
        system: systemPrompt,
        tools: TOOLS_DEF as any,
        stream: true,
      })
      
      return { type: 'anthropic', stream }
    }
    
    // ==================== GEMINI (GOOGLE) ====================
    else if (aiConfig.provider === 'gemini' || aiConfig.provider === 'google') {
      const genAI = new GoogleGenerativeAI(aiConfig.apiKey)
      
      // Convert tools to Gemini format
      const geminiTools = [{
        functionDeclarations: TOOLS_DEF.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.input_schema
        }))
      }]
      
      const geminiModel = genAI.getGenerativeModel({ 
        model: aiConfig.model || 'gemini-1.5-pro',
        systemInstruction: systemPrompt,
        tools: geminiTools as any
      })

      // Prepare history (exclude last message which will be sent as new message)
      let history = cleanMessages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

      // Gemini requires first message to be 'user' role
      while (history.length > 0 && history[0].role === 'model') {
        history.shift()
      }

      const lastMessage = cleanMessages[cleanMessages.length - 1]?.content || ''

      // Step 1: Non-streaming call to check for function calls
      const chatSession = geminiModel.startChat({
        history: history.length > 0 ? history : undefined
      })
      
      const initialResponse = await chatSession.sendMessage(lastMessage)
      const responseResult = initialResponse.response
      
      // Step 2: Check for function calls
      const functionCalls = responseResult.functionCalls()
      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0]
        const toolResult = await this.executeTool(fc.name, fc.args, tenantId)
        
        // Step 3: Send function result back and stream final response
        const finalStream = await chatSession.sendMessageStream([{
          functionResponse: {
            name: fc.name,
            response: { result: toolResult }
          }
        }])
        
        return { type: 'gemini', stream: finalStream.stream }
      }

      // No function call, create a new stream for the response
      // Since we already consumed the response, we need to return the text as a fake stream
      const responseText = responseResult.text()
      const fakeStream = {
        async *[Symbol.asyncIterator]() {
          yield { text: () => responseText }
        }
      }
      
      return { type: 'gemini', stream: fakeStream }
    }
    
    // ==================== OPENAI ====================
    else {
      // Simplified OpenAI implementation (similar logic: check tool_calls -> execute -> stream)
      const openai = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseUrl || undefined,
      })
      
      // OpenAI Tools definition format is slightly different
      const openaiTools = TOOLS_DEF.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema
        }
      }))

      // 1. Call without stream to check tools
      const completion = await openai.chat.completions.create({
        model: aiConfig.model || process.env.AI_MODEL_NAME || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...cleanMessages
        ],
        tools: openaiTools as any,
        stream: false,
      })

      const message = completion.choices[0].message;

      // 2. If tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        // @ts-ignore
        const fn = toolCall.function;
        const args = JSON.parse(fn.arguments);
        const toolResult = await this.executeTool(fn.name, args, tenantId);

        // 3. Stream final response
        const stream = await openai.chat.completions.create({
          model: aiConfig.model || process.env.AI_MODEL_NAME || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...cleanMessages,
            message,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult
            }
          ],
          stream: true,
        });

        return { type: 'openai', stream }
      }

      // If no tool, re-stream
      const stream = await openai.chat.completions.create({
        model: aiConfig.model || process.env.AI_MODEL_NAME || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...cleanMessages
        ],
        stream: true,
        // temperature: 0.3, // Removed for compatibility with o1 models
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
