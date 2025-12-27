import { Elysia, t } from 'elysia'
import { ThreatHuntService } from '../core/services/threat-hunt.service'
import { withAuth, withPermission } from '../middleware/auth'
import { GeminiService } from '../core/ai/gemini.provider'

export const huntingController = new Elysia({ prefix: '/hunting' })
  .use(withAuth)
  
  /**
   * Run raw SQL Query
   * @route POST /hunting/query
   */
  .post('/query', async ({ user, body }: any) => {
      const results = await ThreatHuntService.runQuery(user.tenantId, body.query)
      return { success: true, data: results }
  }, {
      beforeHandle: [withPermission('hunting.run_query') as any],
      body: t.Object({
          query: t.String()
      })
  })

  /**
   * Parse and Run Sigma Rule
   * @route POST /hunting/sigma
   */
  .post('/sigma', async ({ user, body }: any) => {

      const { sql, rule } = await ThreatHuntService.parseSigma(user.tenantId, body.yaml)
      
      let results: any[] = []
      if (body.execute) {
          results = await ThreatHuntService.runQuery(user.tenantId, sql)
      }

      return { 
          success: true, 
          data: {
              rule: rule.title,
              generatedSql: sql,
              results
          }
      }
  }, {
      beforeHandle: [withPermission('hunting.run_query') as any],
      body: t.Object({
          yaml: t.String(),
          execute: t.Optional(t.Boolean())
      })
  })

  /**
   * Natural Language to SQL (AI-Powered)
   * @route POST /hunting/natural
   */
  .post('/natural', async ({ user, body }: any) => {
      const { question, execute } = body;

      // Build prompt for Gemini with ACTUAL column names from ClickHouse
      const prompt = `You are a security analyst assistant. Convert the following natural language question into a ClickHouse SQL query for the 'security_events' table.

IMPORTANT: Use ONLY these exact column names (case-sensitive):
- id, tenant_id, source, timestamp
- severity (values: 'critical', 'high', 'medium', 'low', 'info')
- event_type (values: 'login', 'process', 'network', 'file', etc.)
- title, description
- mitre_tactic, mitre_technique
- host_name, host_ip, host_os, host_agent_id, host_site_name
- user_name, user_domain, user_email
- process_name, process_path, process_cmd, process_pid, process_sha256
- file_name, file_path, file_hash, file_sha256, file_md5
- network_src_ip, network_dst_ip, network_src_port, network_dst_port (NOT dest_ip/dest_port!)
- network_protocol, network_direction
- raw (JSON blob for additional data)

Rules:
1. Use LIKE '%keyword%' for text search (use ILIKE for case-insensitive)
2. Use timestamp >= now() - INTERVAL X DAY for time filters
3. Always ORDER BY timestamp DESC
4. Always LIMIT results (default 50)
5. Return ONLY the SQL query, no explanation or markdown
6. Do NOT include tenant_id filter (it will be added automatically)
7. For port searches use: network_dst_port = 22 (not dest_port)
8. For IP searches use: network_src_ip or network_dst_ip (not src_ip/dest_ip)

User Question: ${question}

SQL Query:`;

      try {
          const sql = await GeminiService.generateText(prompt);
          
          // Clean up the response (remove markdown code blocks if any)
          const cleanSql = sql.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim();
          
          let results: any[] = [];
          if (execute) {
              results = await ThreatHuntService.runQuery(user.tenantId, cleanSql);
          }

          return {
              success: true,
              data: {
                  question,
                  generatedSql: cleanSql,
                  results
              }
          };
      } catch (error: any) {
          console.error('Natural Language Query Error:', error);
          throw new Error(`AI Query Generation Failed: ${error.message}`);
      }
  }, {
      beforeHandle: [withPermission('hunting.run_query') as any],
      body: t.Object({
          question: t.String(),
          execute: t.Optional(t.Boolean())
      })
  })

  /**
   * AI Follow-up Suggestions
   * @route POST /hunting/suggestions
   */
  .post('/suggestions', async ({ user, body }: any) => {
      const { originalQuestion, resultSummary, topValues } = body;

      const prompt = `You are a security analyst assistant. Based on the user's original question and query results, suggest 3-5 relevant follow-up questions for deeper investigation.

Original Question: ${originalQuestion}
Result Summary: ${resultSummary}
Top Values Found: ${JSON.stringify(topValues)}

Rules:
1. Suggest questions that drill deeper into the findings
2. Include questions about related entities (IPs, users, hosts)
3. Include timeline-based questions (before/after events)
4. Include questions about similar patterns
5. Write in the same language as the original question (Thai or English)
6. Return ONLY a JSON array of strings, no explanation

Example output:
["หาเหตุการณ์อื่นจาก IP นี้", "ตรวจสอบ User นี้ในช่วง 7 วันที่ผ่านมา", "Show related network connections"]

Follow-up questions:`;

      try {
          const response = await GeminiService.generateText(prompt);
          
          // Parse JSON response
          let suggestions: string[] = [];
          try {
              const cleaned = response.replace(/\`\`\`json\\n?/gi, '').replace(/\`\`\`\\n?/gi, '').trim();
              suggestions = JSON.parse(cleaned);
          } catch {
              // If parsing fails, split by newlines
              suggestions = response.split('\n')
                  .map(s => s.replace(/^[\d\.\-\*]\s*/, '').replace(/^["']|["']$/g, '').trim())
                  .filter(s => s.length > 0)
                  .slice(0, 5);
          }

          return {
              success: true,
              data: {
                  suggestions: suggestions.slice(0, 5)
              }
          };
      } catch (error: any) {
          console.error('AI Suggestions Error:', error);
          return {
              success: true,
              data: { suggestions: [] }
          };
      }
  }, {
      beforeHandle: [withPermission('hunting.view_results') as any],
      body: t.Object({
          originalQuestion: t.String(),
          resultSummary: t.String(),
          topValues: t.Optional(t.Any())
      })
  })
