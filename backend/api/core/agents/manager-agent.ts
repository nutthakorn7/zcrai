import { BaseAgent, AgentTask, AgentResult } from './base-agent';
import { NetworkAgent } from './network-agent';
import { FileAgent } from './file-agent';
import { UserAgent } from './user-agent';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { alerts } from '../../infra/db/schema';
import { db } from '../../infra/db';
import { eq } from 'drizzle-orm';

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

    async orchestrate(alert: any) {
        this.log(`🕵️ Orchestrating investigation for Alert: ${alert.title}`);
        
        const findings:any[] = [];
        const tasks: Promise<AgentResult>[] = [];

        // 1. Initial Plan (Quick Analysis)
        this.log("Phase 1: Delegating Tasks & Retrieving Context...");

        // Extract Entities
        const entities = this.extractEntities(alert);
        
        // RAG: Retrieve Historical Context
        const historicalContext = await this.findHistoricalContext(entities, alert.tenantId);
        if (historicalContext.length > 0) {
            this.log(`📚 Found ${historicalContext.length} related past cases.`);
        }

        // Assign Network Tasks
        if (entities.ip) {
            tasks.push(this.networkAgent.process({ type: 'check_ip', params: { ip: entities.ip }, priority: 'high' }));
            tasks.push(this.networkAgent.process({ type: 'query_logs', params: { ip: entities.ip, hours: 24 }, priority: 'medium' }));
        }

        // Assign File Tasks
        if (entities.hash) {
            tasks.push(this.fileAgent.process({ type: 'check_hash', params: { hash: entities.hash }, priority: 'high' }));
        }

        // Assign User Tasks
        if (entities.username) {
            tasks.push(this.userAgent.process({ type: 'check_user', params: { username: entities.username }, priority: 'medium' }));
        }

        this.log(`Dispatched ${tasks.length} tasks to swarm.`);
        await this.updateStatus(alert.id, `Dispatched ${tasks.length} tasks to agent swarm...`);

        // 2. Collect Results
        const results = await Promise.allSettled(tasks);
        
        results.forEach((res) => {
            if (res.status === 'fulfilled') {
                findings.push(res.value);
                this.log(`Result from ${res.value.agent}: ${res.value.summary}`);
            } else {
                this.log(`Task failed: ${res.reason}`);
            }
        });

        // 3. Synthesize & Respond
        this.log("Phase 3: Synthesizing Report...");
        const report = await this.generateFinalReport(alert, findings, historicalContext);
        
        // Save Everything
        await this.saveResults(alert.id, findings, report);
        
        this.log("Investigation Complete.");
        return report;
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

    // RAG: Deterministic Context Retrieval
    private async findHistoricalContext(entities: any, tenantId: string) {
        // Collect all values to search
        const values = [entities.ip, entities.username, entities.hash].filter(v => v);
        
        if (values.length === 0) return [];

        // Find past resolved cases containing these observables
        // This is a simplified "Knowledge Graph" traversal: Alert -> Observables -> Past Cases
        // Note: We use raw SQL or query builder. Drizzle query builder is safer.
        
        // Since we can't easily do complex joins in one go without 'inArray', let's find observables first
        const { observables, cases } = await import('../../infra/db/schema');
        const { inArray, and, eq, isNotNull, ne } = await import('drizzle-orm');

        const relatedObservables = await db.select({ caseId: observables.caseId })
            .from(observables)
            .where(and(
                inArray(observables.value, values),
                eq(observables.tenantId, tenantId),
                isNotNull(observables.caseId)
            ))
            .limit(10); // Limit traversal

        const uniqueCaseIds = [...new Set(relatedObservables.map(o => o.caseId).filter(id => id !== null))] as string[];

        if (uniqueCaseIds.length === 0) return [];

        // Fetch Case Details
        const relatedCases = await db.query.cases.findMany({
            where: and(
                inArray(cases.id, uniqueCaseIds),
                isNotNull(cases.resolvedAt) // Only "Lesson Learned" cases
            ),
            with: {
                attachments: true // Maybe contains reports?
            },
            limit: 3 // Top 3 most relevant
        });

        return relatedCases.map(c => ({
            title: c.title,
            description: c.description,
            resolution: c.status, // or add a 'resolution_notes' field in future
            tags: c.tags,
            date: c.createdAt
        }));
    }

    private async generateFinalReport(alert: any, findings: AgentResult[], history: any[]) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return "AI Service Unavailable. See raw findings.";

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const findingsText = findings.map(f => `[${f.agent}] ${f.summary}`).join('\n');
        const historyText = history.length > 0 
            ? history.map(h => `- [Past Case] "${h.title}" (${h.date}): ${h.description}`).join('\n')
            : "No relevant historical cases found.";
        
        const prompt = `
            You are the Lead Security Investigator (Manager Agent).
            Review the findings from your team of specialist agents.
            
            Alert: ${alert.title}
            Description: ${alert.description}

            Team Findings:
            ${findingsText}

            **Historical Context (RAG)**:
            ${historyText}

            **Instructions**:
            1. Generate a concise Executive Summary and final verdict (True/False Positive).
            2. STRICTLY use only the Team Findings and Alert data provided above.
            3. DO NOT use external security knowledge, internet data, or general AI training to hallucinate details not found in the records.
            4. If the data is insufficient, state that some details are missing from internal records.
        `;

        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (e) {
            return "Failed to generate AI report.";
        }
    }

    private async updateStatus(alertId: string, status: string) {
         // UI hook - in real app would push via websocket
         console.log(`[UI Update] ${status}`);
    }

    private async saveResults(alertId: string, findings: any[], report: string) {
        // Find existing analysis to merge
        const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));
        const currentAnalysis = alert?.aiAnalysis || {};

        await db.update(alerts).set({
            aiAnalysis: {
                ...currentAnalysis as any,
                investigationReport: report,
                swarmFindings: findings,
                investigationStatus: 'completed',
                investigatedAt: new Date().toISOString()
            }
        }).where(eq(alerts.id, alertId));
    }
}
