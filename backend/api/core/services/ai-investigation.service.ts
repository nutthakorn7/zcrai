
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { db } from '../../infra/db';
import { alerts } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { VirusTotalProvider } from '../enrichment-providers/virustotal';
import { AbuseIPDBProvider } from '../enrichment-providers/abuseipdb';
import { AlienVaultOTXProvider } from '../enrichment-providers/alienvault-otx';
import { clickhouse } from '../../infra/clickhouse/client';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// --- Constants ---
const MAX_STEPS = 5;

// --- PIRA Phases ---
type PIRAPhase = 'plan' | 'investigate' | 'respond' | 'adapt';

interface InvestigationPlan {
    questions: string[];          // Questions to answer
    plannedSteps: string[];       // Tools/actions to take
    hypothesis: string;           // Initial hypothesis
    priority: 'critical' | 'high' | 'medium' | 'low';
}

interface InvestigationStep {
    id: number;
    tool: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    startedAt?: string;
    completedAt?: string;
}

// --- Real Tool Providers ---
// Providers are now used by individual Agents
// const virusTotalProvider = new VirusTotalProvider();
// const abuseIPDBProvider = new AbuseIPDBProvider();
// const alienVaultProvider = new AlienVaultOTXProvider();

// --- Tool Implementations ---
// Removed in favor of Agent Classes

// function lookupUser removed
// function lookupHash removed

// --- Tool Registry ---
// Tools are now encapsulated within Agents (NetworkAgent, FileAgent, UserAgent)
// Legacy tool functions removed in favor of Agent classes

// --- Agent Loop ---
export class AIInvestigationService {

    /**
     * PIRA-Enhanced Multi-Agent Swarm Investigation
     * Phase 1: PLAN - Manager delegates tasks
     * Phase 2: INVESTIGATE - Agents execute in parallel
     * Phase 3: RESPOND - Manager synthesizes report
     */
    static async investigate(alert: any) {
        console.log(`\n[AI Swarm] 🐝 Starting Swarm Investigation for ${alert.id}`);
        console.log(`[AI Swarm] ════════════════════════════════════════════════`);

        try {
            const { ManagerAgent } = await import('../agents/manager-agent');
            const manager = new ManagerAgent();
            
            await manager.orchestrate(alert);
            
            console.log(`[AI Swarm] ✅ Investigation Complete`);
            
        } catch (error: any) {
            console.error('[AI Swarm] Investigation Failed:', error.message);
            await db.update(alerts)
                .set({
                    aiAnalysis: {
                        ...alert.aiAnalysis,
                        investigationStatus: 'failed',
                        error: error.message
                    }
                })
                .where(eq(alerts.id, alert.id));
        }
    }

}
