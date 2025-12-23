
export interface AgentResult {
    agent: string;
    status: 'success' | 'failed';
    data?: any;
    error?: string;
    summary: string;
}

export interface AgentTask {
    type: string;
    params: any;
    priority: 'high' | 'medium' | 'low';
}

export abstract class BaseAgent {
    protected name: string;
    
    constructor(name: string) {
        this.name = name;
    }

    abstract process(task: AgentTask): Promise<AgentResult>;

    protected log(message: string) {
        console.log(`[Agent: ${this.name}] ${message}`);
    }
}
