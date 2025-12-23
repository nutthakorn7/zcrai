import { BaseAgent, AgentTask, AgentResult } from './base-agent';

export class UserAgent extends BaseAgent {
    constructor() {
        super('User');
    }

    async process(task: AgentTask): Promise<AgentResult> {
        this.log(`Received task: ${task.type}`);
        
        try {
            switch (task.type) {
                case 'check_user':
                    return await this.checkUser(task.params.username);
                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }
        } catch (error: any) {
            return {
                agent: this.name,
                status: 'failed',
                error: error.message,
                summary: `User analysis failed: ${error.message}`
            };
        }
    }

    private async checkUser(username: string): Promise<AgentResult> {
        this.log(`Checking user: ${username}`);
        
        // Mock User Analysis (In real system, query AD/LDAP or User Entity Behavior Analytics)
        const mockRisk = Math.floor(Math.random() * 100);
        const department = ['IT', 'HR', 'Sales', 'Finance'][Math.floor(Math.random() * 4)];
        
        const data = {
            username,
            department,
            riskScore: mockRisk,
            lastLogin: new Date().toISOString(),
            privileged: department === 'IT'
        };

        const isRisky = mockRisk > 70;

        return {
            agent: this.name,
            status: 'success',
            data,
            summary: isRisky
                ? `⚠️ User ${username} (${department}) has HIGH risk score (${mockRisk}).`
                : `✅ User ${username} (${department}) behavior seems normal (Risk: ${mockRisk}).`
        };
    }
}
