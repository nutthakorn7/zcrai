import { describe, expect, test, mock } from "bun:test";
import { TimelineService } from "../core/services/timeline.service";

// Mock DB 
mock.module('../infra/db', () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => [
                     // Mock Alert return
                     { 
                         id: 'alert-123', 
                         title: 'Test Alert', 
                         severity: 'HIGH', 
                         source: 'EDR',
                         status: 'OPEN',
                         createdAt: new Date('2023-01-01T12:00:00Z') 
                     }
                ]
            })
        })
    }
}));

describe("TimelineService", () => {
    test("getTimeline should return sorted events", async () => {
        const events = await TimelineService.getTimeline("tenant-1", "alert-123");
        
        expect(events.length).toBeGreaterThan(0);
        
        // Main alert should be there
        const alertEvent = events.find(e => e.type === 'ALERT');
        expect(alertEvent).toBeDefined();
        expect(alertEvent?.title).toContain('Test Alert');

        // Verify sorting (Oldest first)
        const timestamps = events.map(e => e.timestamp.getTime());
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
        expect(timestamps).toEqual(sortedTimestamps);
    });
});
