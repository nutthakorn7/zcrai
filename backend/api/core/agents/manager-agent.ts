import { BaseAgent, AgentTask, AgentResult } from './base-agent';
import { NetworkAgent } from './network-agent';
import { FileAgent } from './file-agent';
import { UserAgent } from './user-agent';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { alerts } from '../../infra/db/schema';
import { db } from '../../infra/db';
import { eq } from 'drizzle-orm';
import { AITraceService } from '../services/ai-trace.service';

export class ManagerAgent extends BaseAgent {
    private networkAgent = new NetworkAgent();
    private fileAgent = new FileAgent();
    private userAgent = new UserAgent();

    constructor() {
        super('Manager');
    }

    // Manager doesn't process simple tasks, it orchestrates the whole investigation
    async process(task: AgentTask): Promise<AgentResult> {
        throw new Error("Manager agent should be called via orchestrate()");
    }

    async orchestrate(alert: any, maxRounds: number = 3) {
        this.log(`🕵️ Orchestrating investigation for Alert: ${alert.title}`);
        
        let round = 1;
        const allFindings: any[] = [];
        const investigationLog: string[] = [];
        
        try {
            // Extract initial entities
            const entities = this.extractEntities(alert);
            
            // RAG: Retrieve Historical Context
            const historicalContext = await this.findHistoricalContext(entities, alert.tenantId);
            if (historicalContext.length > 0) {
                this.log(`📚 Found ${historicalContext.length} related past cases.`);
                investigationLog.push(`Round 0: Retrieved ${historicalContext.length} historical context items`);
            }

            while (round <= maxRounds) {
                this.log(`\n🔄 === Investigation Round ${round}/${maxRounds} ===`);
                investigationLog.push(`\n--- Round ${round} ---`);
                
                const tasks: Promise<AgentResult>[] = [];

                // Round 1: AI-driven tool selection OR fallback to hardcoded
                if (round === 1) {
                    let usedAIToolPlanning = false;
                    
                    // Try AI-driven tool planning first
                    try {
                        const { AIToolCallingService } = await import('../services/ai-tool-calling.service');
                        const plannedCalls = await AIToolCallingService.planToolCalls({
                            tenantId: alert.tenantId,
                            alertTitle: alert.title,
                            alertDescription: alert.description || '',
                            entities,
                            objective: 'Investigate the security alert and determine if it is a true or false positive'
                        });

                        // Log the thought process (planning)
                        if (plannedCalls.length > 0) {
                            await AITraceService.logTrace({
                                tenantId: alert.tenantId,
                                alertId: alert.id,
                                agentName: this.name,
                                thought: `Round 1 Planning: Decided to execute ${plannedCalls.length} initial tools based on alert context.`,
                                action: plannedCalls
                            });
                        }
                        
                        if (plannedCalls.length > 0) {
                            this.log(`🤖 AI planned ${plannedCalls.length} tool calls`);
                            investigationLog.push(`AI Tool Planning: ${plannedCalls.map(c => c.tool).join(', ')}`);
                            
                            // Execute planned tools
                            const toolResults = await AIToolCallingService.executeToolCalls(plannedCalls, { tenantId: alert.tenantId });
                            
                            for (const result of toolResults) {
                                allFindings.push({
                                    agent: result.tool,
                                    status: 'success',
                                    data: result.result,
                                    summary: `[${result.tool}] ${result.reason}`
                                });
                                investigationLog.push(`[${result.tool}] ${result.reason}`);
                                
                                // Log tool execution & observation
                                await AITraceService.logTrace({
                                    tenantId: alert.tenantId,
                                    alertId: alert.id,
                                    agentName: result.tool,
                                    observation: result.result
                                });
                            }
                            
                            usedAIToolPlanning = true;
                        }
                    } catch (e) {
                        this.log(`AI tool planning failed, using fallback: ${(e as Error).message}`);
                    }
                    
                    // Fallback to hardcoded if AI planning didn't work
                    if (!usedAIToolPlanning) {
                        if (entities.ip) {
                            tasks.push(this.networkAgent.process({ type: 'check_ip', params: { ip: entities.ip }, priority: 'high' }));
                            tasks.push(this.networkAgent.process({ type: 'query_logs', params: { ip: entities.ip, hours: 24 }, priority: 'medium' }));
                        }
                        if (entities.hash) {
                            tasks.push(this.fileAgent.process({ type: 'check_hash', params: { hash: entities.hash }, priority: 'high' }));
                        }
                        if (entities.username) {
                            tasks.push(this.userAgent.process({ type: 'check_user', params: { username: entities.username, tenantId: alert.tenantId }, priority: 'medium' }));
                        }
                    }
                }

                // Round 2+: AI-driven follow-up tasks
                if (round > 1) {
                    const followUpTasks = await this.determineFollowUpTasks(alert, allFindings, investigationLog);
                    
                    // Log the follow-up thought process
                    await AITraceService.logTrace({
                        tenantId: alert.tenantId,
                        alertId: alert.id,
                        agentName: this.name,
                        thought: `Round ${round} Planning: Determined ${followUpTasks.length} follow-up tasks based on previous findings.`,
                        action: followUpTasks
                    });

                    if (followUpTasks.length === 0) {
                        this.log('✅ AI determined no follow-up needed. Investigation complete.');
                        investigationLog.push('AI: No further investigation needed.');
                        break;
                    }
                    
                    for (const task of followUpTasks) {
                        investigationLog.push(`Follow-up: ${task.description}`);
                        
                        switch (task.agent) {
                            case 'network':
                                tasks.push(this.networkAgent.process(task.task));
                                break;
                            case 'file':
                                tasks.push(this.fileAgent.process(task.task));
                                break;
                            case 'user':
                                tasks.push(this.userAgent.process(task.task));
                                break;
                        }
                    }
                }

                if (tasks.length === 0) {
                    this.log('No tasks to execute this round.');
                    break;
                }

                this.log(`Dispatched ${tasks.length} tasks.`);
                await this.updateStatus(alert.id, `Round ${round}: Dispatched ${tasks.length} tasks...`);

                // Execute and collect results
                const results = await Promise.allSettled(tasks);
                
                for (const res of results) {
                    if (res.status === 'fulfilled') {
                        allFindings.push(res.value);
                        this.log(`Result from ${res.value.agent}: ${res.value.summary}`);
                        investigationLog.push(`[${res.value.agent}] ${res.value.summary}`);

                        // Log trace for manual/fallback/follow-up agent execution
                        await AITraceService.logTrace({
                            tenantId: alert.tenantId,
                            alertId: alert.id,
                            agentName: res.value.agent,
                            observation: res.value.data
                        });
                    } else {
                        this.log(`Task failed: ${res.reason}`);
                        investigationLog.push(`[ERROR] Task failed: ${res.reason}`);
                    }
                }

                round++;
            }

            // Final Synthesis
            this.log('\n📝 Phase Final: Synthesizing Report...');
            const report = await this.generateFinalReport(alert, allFindings, historicalContext, investigationLog);
            
            // Save Everything
            await this.saveResults(alert.id, allFindings, report, investigationLog);
            
            // Learn from this investigation (Memory/Learning)
            try {
                const { AgentMemoryService } = await import('../services/agent-memory.service');
                await AgentMemoryService.learnFromInvestigation(alert.tenantId, alert.id);
                this.log('🧠 Learned patterns from this investigation.');
            } catch (e) {
                this.log(`Learning failed: ${(e as Error).message}`);
            }
            
            this.log('✅ Multi-turn Investigation Complete.');
            return report;
        } catch (error) {
            this.log(`❌ Orchestration failed: ${(error as Error).message}`);
            await this.updateStatus(alert.id, `Investigation Failed ❌: ${(error as Error).message}`);
            
            // Find existing analysis to merge
            const [alertData] = await db.select().from(alerts).where(eq(alerts.id, alert.id));
            const currentAnalysis = alertData?.aiAnalysis || {};

            await db.update(alerts).set({
                aiAnalysis: {
                    ...currentAnalysis as any,
                    swarmFindings: allFindings,
                    investigationLog: [...investigationLog, `CRITICAL ERROR: ${(error as Error).message}`],
                    investigationStatus: 'failed',
                    investigatedAt: new Date().toISOString()
                }
            }).where(eq(alerts.id, alert.id));
            
            throw error;
        }
    }

    /**
     * AI-driven determination of follow-up tasks based on current findings
     */
    private async determineFollowUpTasks(alert: any, findings: any[], log: string[]): Promise<{agent: string, task: AgentTask, description: string}[]> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return [];

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const findingsText = findings.map(f => `[${f.agent}] ${f.summary}`).join('\n');
            
            const prompt = `
You are a security investigation AI. Based on current findings, determine if more investigation is needed.

Alert: ${alert.title}
Description: ${alert.description}

Current Findings:
${findingsText}

Available follow-up actions:
1. query_logs(ip, hours) - Query more logs for an IP
2. check_ip(ip) - Check reputation of a new IP found
3. check_hash(hash) - Analyze a file hash
4. check_user(username) - Analyze a user's behavior
5. analyze_process(processName) - Analyze a process

If NO follow-up is needed (findings are sufficient), respond with: {"followUps": []}

If follow-up IS needed, respond with JSON like:
{
  "followUps": [
    {"agent": "network", "type": "check_ip", "params": {"ip": "x.x.x.x"}, "reason": "Found suspicious IP in logs"},
    {"agent": "user", "type": "check_user", "params": {"username": "admin"}, "reason": "User performed unusual action"}
  ]
}

ONLY respond with valid JSON, no markdown or extra text.`;

            const result = await model.generateContent(prompt);
            
            // Record Usage
            try {
                const { AICostControlService } = await import('../services/ai-cost-control.service');
                if (result.response.usageMetadata) {
                    await AICostControlService.recordUsage(alert.tenantId, { tokens: result.response.usageMetadata as any });
                }
            } catch (e) {
                this.log(`Usage recording failed: ${(e as Error).message}`);
            }

            const responseText = result.response.text().trim();
            
            // Parse JSON
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return [];
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            if (!parsed.followUps || parsed.followUps.length === 0) return [];

            return parsed.followUps.map((f: any) => ({
                agent: f.agent,
                task: { type: f.type, params: f.params, priority: 'medium' as const },
                description: f.reason || `Follow-up: ${f.type}`
            }));
        } catch (e) {
            this.log(`Follow-up determination failed: ${(e as Error).message}`);
            return [];
        }
    }

    private extractEntities(alert: any) {
        return {
            ip: alert.observables?.find((o: any) => o.type === 'ip')?.value || 
                alert.rawData?.dest_ip || alert.rawData?.source_ip || alert.rawData?.host_ip,
            username: alert.rawData?.user_name || alert.rawData?.user,
            hash: alert.observables?.find((o: any) => o.type === 'hash')?.value ||
                  alert.rawData?.file_hash || alert.rawData?.sha256
        };
    }

    // RAG: Hybrid Context Retrieval (Keyword + Semantic)
    private async findHistoricalContext(entities: any, tenantId: string) {
        const results: any[] = [];
        
        // METHOD 1: Observable-based keyword search (existing)
        const values = [entities.ip, entities.username, entities.hash].filter(v => v);
        
        if (values.length > 0) {
            try {
                const { observables, cases } = await import('../../infra/db/schema');
                const { inArray, and, eq, isNotNull } = await import('drizzle-orm');

                const relatedObservables = await db.select({ caseId: observables.caseId })
                    .from(observables)
                    .where(and(
                        inArray(observables.value, values),
                        eq(observables.tenantId, tenantId),
                        isNotNull(observables.caseId)
                    ))
                    .limit(10);

                const uniqueCaseIds = [...new Set(relatedObservables.map(o => o.caseId).filter(id => id !== null))] as string[];

                if (uniqueCaseIds.length > 0) {
                    const relatedCases = await db.query.cases.findMany({
                        where: and(
                            inArray(cases.id, uniqueCaseIds),
                            isNotNull(cases.resolvedAt)
                        ),
                        limit: 3
                    });

                    results.push(...relatedCases.map(c => ({
                        title: c.title,
                        description: c.description,
                        resolution: c.status,
                        tags: c.tags,
                        date: c.createdAt,
                        source: 'keyword'
                    })));
                }
            } catch (e) {
                this.log(`Keyword search failed: ${(e as Error).message}`);
            }
        }

        // METHOD 2: Semantic Vector Search (NEW - RAG)
        try {
            const { EmbeddingService } = await import('../services/embedding.service');
            
            // Build semantic query from alert context
            const semanticQuery = [
                entities.ip ? `IP address ${entities.ip}` : '',
                entities.username ? `User ${entities.username}` : '',
                entities.hash ? `File hash ${entities.hash}` : ''
            ].filter(Boolean).join(', ');

            if (semanticQuery) {
                this.log(`🔍 Semantic search: "${semanticQuery.substring(0, 50)}..."`);
                
                const similarAlerts = await EmbeddingService.searchSimilar(tenantId, semanticQuery, 3);
                
                // Convert to context format
                for (const alert of similarAlerts) {
                    // Avoid duplicates
                    if (!results.some(r => r.title === alert.title)) {
                        results.push({
                            title: alert.title,
                            description: alert.description,
                            resolution: (alert.aiAnalysis as any)?.investigationReport ? 'investigated' : alert.status,
                            tags: [],
                            date: alert.createdAt,
                            source: 'semantic'
                        });
                    }
                }
            }
        } catch (e) {
            this.log(`Semantic search failed: ${(e as Error).message}`);
        }

        this.log(`📚 Found ${results.length} historical context items (${results.filter(r => r.source === 'keyword').length} keyword, ${results.filter(r => r.source === 'semantic').length} semantic)`);
        
        return results.slice(0, 5); // Return top 5
    }

    private async generateFinalReport(alert: any, findings: AgentResult[], history: any[], investigationLog: string[] = []) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return "AI Service Unavailable. See raw findings.";

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const findingsText = findings.map(f => `[${f.agent}] ${f.summary}`).join('\n');
        const historyText = history.length > 0 
            ? history.map(h => `- [Past Case] "${h.title}" (${h.date}): ${h.description}`).join('\n')
            : "No relevant historical cases found.";
        const logText = investigationLog.length > 0 ? investigationLog.join('\n') : '';
        
        const prompt = `
            You are the Lead Security Investigator (Manager Agent).
            Review the findings from your team of specialist agents.
            
            Alert: ${alert.title}
            Description: ${alert.description}

            Team Findings:
            ${findingsText}

            **Historical Context (RAG)**:
            ${historyText}

            **Investigation Log**:
            ${logText}

            **Instructions**:
            1. Generate a concise Executive Summary and final verdict (True/False Positive).
            2. STRICTLY use only the Team Findings and Alert data provided above.
            3. DO NOT use external security knowledge, internet data, or general AI training to hallucinate details not found in the records.
            4. If the data is insufficient, state that some details are missing from internal records.
        `;

        try {
            const result = await model.generateContent(prompt);

        // Record Usage
        try {
            const { AICostControlService } = await import('../services/ai-cost-control.service');
            if (result.response.usageMetadata) {
                await AICostControlService.recordUsage(alert.tenantId, { tokens: result.response.usageMetadata as any });
            }
        } catch (e) {
            this.log(`Usage recording failed: ${(e as Error).message}`);
        }

        return result.response.text();
        } catch (e) {
            return "Failed to generate AI report.";
        }
    }

    private async updateStatus(alertId: string, status: string, extra?: { round?: number; maxRounds?: number; finding?: any }) {
        console.log(`[UI Update] ${status}`);
        
        // Push real-time update via WebSocket
        try {
            const { SocketService } = await import('../services/socket.service');
            const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));
            
            if (alert?.tenantId) {
                const phase = status.includes('started') ? 'started' as const
                    : status.includes('Round') ? 'round' as const
                    : status.includes('Complete') ? 'completed' as const
                    : 'finding' as const;
                    
                SocketService.notifyInvestigationStatus(alert.tenantId, alertId, {
                    phase,
                    round: extra?.round,
                    maxRounds: extra?.maxRounds,
                    message: status,
                    finding: extra?.finding
                });
            }
        } catch (e) {
            // Socket push is non-critical
            console.warn(`[Socket] Failed to push update: ${(e as Error).message}`);
        }
    }

    private async saveResults(alertId: string, findings: any[], report: string, investigationLog: string[] = []) {
        // Find existing analysis to merge
        const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));
        const currentAnalysis = alert?.aiAnalysis || {};

        await db.update(alerts).set({
            aiAnalysis: {
                ...currentAnalysis as any,
                investigationReport: report,
                swarmFindings: findings,
                investigationLog,
                investigationRounds: investigationLog.filter(l => l.includes('--- Round')).length,
                investigationStatus: 'completed',
                investigatedAt: new Date().toISOString()
            }
        }).where(eq(alerts.id, alertId));
    }
}
