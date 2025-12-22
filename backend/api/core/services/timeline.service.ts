import { db } from '../../infra/db';
import { alerts, users } from '../../infra/db/schema';
import { eq, desc, or } from 'drizzle-orm';

export interface TimelineEvent {
    id: string;
    timestamp: Date;
    type: 'ALERT' | 'LOG' | 'ACTION' | 'NOTE';
    title: string;
    severity?: string;
    metadata?: any;
    actor?: string;
}

export class TimelineService {

    /**
     * Get a consolidated timeline for an alert context
     * (Currently mocks logs/actions as we don't have a direct link table yet, but fetches alerts)
     */
    static async getTimeline(tenantId: string, alertId: string): Promise<TimelineEvent[]> {
        const events: TimelineEvent[] = [];

        // 1. Fetch main alert
        const [mainAlert] = await db.select().from(alerts)
            .where(eq(alerts.id, alertId));

        if (!mainAlert) throw new Error("Alert not found");

        // Add main alert creation
        events.push({
            id: mainAlert.id,
            timestamp: mainAlert.createdAt,
            type: 'ALERT',
            title: `Alert Triggered: ${mainAlert.title}`,
            severity: mainAlert.severity,
            metadata: { source: mainAlert.source }
        });

        // 2. Fetch related alerts (Mock logic: Same IP or Host)
        // In real app, we'd use graph usage. 
        // For MVP, we'll just add some mock contextual events to demonstrate the Visual Timeline
        
        // Mock Logs (Pre-alert)
        events.push({
            id: 'log-1',
            timestamp: new Date(mainAlert.createdAt.getTime() - 1000 * 60 * 5), // 5 mins before
            type: 'LOG',
            title: 'Suspicious Login Attempt',
            metadata: { ip: '192.168.1.100', user: 'admin' }
        });

        events.push({
            id: 'log-2',
            timestamp: new Date(mainAlert.createdAt.getTime() - 1000 * 60 * 2), // 2 mins before
            type: 'LOG',
            title: 'Process Spawned: powershell.exe',
            metadata: { cmd: '-enc AAB...' }
        });

        // Mock Automated Actions (Post-alert)
        if (mainAlert.status !== 'OPEN') {
             events.push({
                id: 'action-1',
                timestamp: new Date(mainAlert.createdAt.getTime() + 1000 * 30), // 30s after
                type: 'ACTION',
                title: 'Automated Response: Block IP',
                actor: 'System (Playbook)',
                metadata: { action: 'BLOCK_IP' }
            });
        }

        return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
}
