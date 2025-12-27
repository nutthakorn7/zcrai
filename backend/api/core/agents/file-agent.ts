import { BaseAgent, AgentTask, AgentResult } from './base-agent';
import { VirusTotalProvider } from '../enrichment-providers/virustotal';

export class FileAgent extends BaseAgent {
    private vtProvider = new VirusTotalProvider();

    constructor() {
        super('File');
    }

    async process(task: AgentTask): Promise<AgentResult> {
        this.log(`Received task: ${task.type}`);
        
        try {
            switch (task.type) {
                case 'check_hash':
                    return await this.checkHash(task.params.hash);
                case 'analyze_process':
                    // Mock process analysis for now
                    return {
                        agent: this.name,
                        status: 'success',
                        data: { process: task.params.processName, risk: 'low' },
                        summary: `Process ${task.params.processName} seems normal (Mock Analysis)`
                    };
                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }
        } catch (error: any) {
            return {
                agent: this.name,
                status: 'failed',
                error: error.message,
                summary: `File analysis failed: ${error.message}`
            };
        }
    }

    private async checkHash(hash: string): Promise<AgentResult> {
        this.log(`Checking hash: ${hash}`);
        try {
            const result = await this.vtProvider.enrichHash(hash);
            
            const isMalicious = (result as any)?.malicious || (result as any)?.positives > 0;
            const ratio = (result as any)?.detectionRatio || '0/0';

            return {
                agent: this.name,
                status: 'success',
                data: result,
                summary: isMalicious
                    ? `💀 File Hash is MALICIOUS (${ratio}). Known malware.`
                    : `✅ File Hash appears safe (${ratio}).`
            };
        } catch (e: any) {
             return {
                agent: this.name,
                status: 'failed',
                error: e.message,
                summary: `Hash lookup failed for ${hash}`
            };
        }
    }
}
