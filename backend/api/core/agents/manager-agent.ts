import { BaseAgent, AgentTask, AgentResult } from './base-agent';
import { NetworkAgent } from './network-agent';
import { FileAgent } from './file-agent';
import { UserAgent } from './user-agent';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { alerts } from '../../infra/db/schema';
import { db } from '../../infra/db';
import { eq } from 'drizzle-orm';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

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
        this.log("Phase 1: Delegating Tasks...");

        // Extract Entities
        const entities = this.extractEntities(alert);
        
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
        const report = await this.generateFinalReport(alert, findings);
        
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

    private async generateFinalReport(alert: any, findings: AgentResult[]) {
        if (!genAI) return "AI Service Unavailable. See raw findings.";

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const findingsText = findings.map(f => `[${f.agent}] ${f.summary}`).join('\n');
        
        const prompt = `
            You are the Lead Security Investigator (Manager Agent).
            Review the findings from your team of specialist agents.
            
            Alert: ${alert.title}
            Description: ${alert.description}

            Team Findings:
            ${findingsText}

            Generate a concise Executive Summary and final verdict (True/False Positive).
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
                ...currentAnalysis,
                investigationReport: report,
                swarmFindings: findings,
                investigationStatus: 'completed',
                investigatedAt: new Date().toISOString()
            }
        }).where(eq(alerts.id, alertId));
    }
}
