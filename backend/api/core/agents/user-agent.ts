import { BaseAgent, AgentTask, AgentResult } from './base-agent';
import { db } from '../../infra/db';
import { users, loginHistory, sessions } from '../../infra/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

export class UserAgent extends BaseAgent {
    constructor() {
        super('User');
    }

    async process(task: AgentTask): Promise<AgentResult> {
        this.log(`Received task: ${task.type}`);
        
        try {
            switch (task.type) {
                case 'check_user':
                    return await this.checkUser(task.params.username, task.params.tenantId);
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

    private async checkUser(username: string, tenantId?: string): Promise<AgentResult> {
        this.log(`Checking user: ${username}`);
        
        // 1. Find user in database
        const userRecords = await db.select()
            .from(users)
            .where(eq(users.email, username))
            .limit(1);
        
        if (userRecords.length === 0) {
            // Try partial match (username without domain)
            const allUsers = await db.select().from(users);
            const matchedUser = allUsers.find(u => 
                u.email.toLowerCase().includes(username.toLowerCase()) ||
                u.name?.toLowerCase().includes(username.toLowerCase())
            );
            
            if (!matchedUser) {
                return {
                    agent: this.name,
                    status: 'success',
                    data: { username, found: false },
                    summary: `⚠️ User "${username}" not found in directory.`
                };
            }
            userRecords.push(matchedUser);
        }
        
        const user = userRecords[0];
        
        // 2. Get recent login history (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentLogins = await db.select()
            .from(loginHistory)
            .where(and(
                eq(loginHistory.userId, user.id),
                gte(loginHistory.timestamp, thirtyDaysAgo)
            ))
            .orderBy(desc(loginHistory.timestamp))
            .limit(20);
        
        // 3. Get active sessions
        const activeSessions = await db.select()
            .from(sessions)
            .where(and(
                eq(sessions.userId, user.id),
                eq(sessions.isValid, true)
            ));
        
        // 4. Calculate Risk Score based on real behavior
        let riskScore = 0;
        const riskFactors: string[] = [];
        
        // Factor 1: Privileged role (+20 risk)
        const privilegedRoles = ['superadmin', 'admin', 'tenant_admin'];
        if (privilegedRoles.includes(user.role)) {
            riskScore += 20;
            riskFactors.push(`Privileged role: ${user.role}`);
        }
        
        // Factor 2: Multiple active sessions (+15 risk)
        if (activeSessions.length > 3) {
            riskScore += 15;
            riskFactors.push(`Multiple sessions: ${activeSessions.length}`);
        }
        
        // Factor 3: Logins from multiple countries (+25 risk)
        const uniqueCountries = [...new Set(recentLogins.map(l => l.country).filter(Boolean))];
        if (uniqueCountries.length > 2) {
            riskScore += 25;
            riskFactors.push(`Multi-geo logins: ${uniqueCountries.join(', ')}`);
        }
        
        // Factor 4: Recent unusual hours (outside 6am-10pm) (+15 risk)
        const unusualHourLogins = recentLogins.filter(l => {
            const hour = new Date(l.timestamp).getHours();
            return hour < 6 || hour > 22;
        });
        if (unusualHourLogins.length > 3) {
            riskScore += 15;
            riskFactors.push(`Unusual hour logins: ${unusualHourLogins.length}`);
        }
        
        // Factor 5: No recent activity might indicate compromised dormant account (+10 risk)
        if (recentLogins.length === 0) {
            riskScore += 10;
            riskFactors.push('No recent login activity');
        }
        
        // Cap at 100
        riskScore = Math.min(riskScore, 100);
        
        const isRisky = riskScore > 50;
        
        const data = {
            username: user.email,
            name: user.name,
            role: user.role,
            riskScore,
            riskFactors,
            recentLoginCount: recentLogins.length,
            activeSessionCount: activeSessions.length,
            uniqueCountries,
            lastLogin: recentLogins[0]?.timestamp || null,
            privileged: privilegedRoles.includes(user.role)
        };

        return {
            agent: this.name,
            status: 'success',
            data,
            summary: isRisky
                ? `⚠️ User ${user.email} (${user.role}) has ELEVATED risk score (${riskScore}). Factors: ${riskFactors.join('; ')}`
                : `✅ User ${user.email} (${user.role}) behavior is normal (Risk: ${riskScore}).`
        };
    }
}
