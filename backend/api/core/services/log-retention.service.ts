import { db } from '../../infra/db';
import { systemConfig, auditLogs, sessions, notifications } from '../../infra/db/schema';
import { eq, lt, sql } from 'drizzle-orm';
import { CronJob } from 'cron';

export const LogRetentionService = {
  /**
   * Initialize the cron job
   */
  init() {
    console.log('✅ LogRetentionService initialized');
    
    // Run every hour to check disk health and retention
    new CronJob(
      '0 * * * *',
      async () => {
        console.log('🧹 Running Log Retention & Storage Protection Job...');
        await this.checkStorageAndCleanup();
      },
      null,
      true,
      'Asia/Bangkok'
    );
  },

  /**
   * Monitor Storage and Trigger Cleanup
   */
  async checkStorageAndCleanup() {
    const isDiskFull = await this.checkDiskUsage(); // Mock or system call
    
    if (isDiskFull) {
        console.warn('⚠️ [StorageProtection] Disk usage high (>85%). Triggering aggressive cleanup.');
        // If disk is full, we temporarily reduce retention policy by 50% to free up space
        await this.cleanup(0.5); 
    } else {
        await this.cleanup(1.0);
    }
  },

  /**
   * Mock for disk usage check
   * In production, this would use 'df -h' or a node-disk-info package
   */
  async checkDiskUsage(): Promise<boolean> {
      // Logic for checking ClickHouse/Postgres volumes
      return false; // Default safe
  },

  /**
   * Run cleanup logic based on configured retention days
   * @param factor Reduction factor for capacity-based eviction (0.1 to 1.0)
   */
  async cleanup(factor: number = 1.0) {
    try {
      // 1. Fetch retention settings
      const auditLogDays = Math.floor(await this.getConfig('retention.audit_logs_days', 90) * factor);
      const notificationDays = Math.floor(await this.getConfig('retention.notifications_days', 30) * factor);
      const sessionDays = Math.floor(await this.getConfig('retention.sessions_days', 7) * factor);

      console.log(`[LogRetention] Active Policy (Factor ${factor}): Audit=${auditLogDays}d, Notif=${notificationDays}d, Sess=${sessionDays}d`);
      // ... existing cleanup logic ...

      // 2. Cleanup Audit Logs
      const auditCutoff = new Date(Date.now() - auditLogDays * 24 * 60 * 60 * 1000);
      const deletedAudit = await db.delete(auditLogs).where(lt(auditLogs.createdAt, auditCutoff)).returning({ id: auditLogs.id });
      console.log(`[LogRetention] Deleted ${deletedAudit.length} old audit logs.`);

      // 3. Cleanup Notifications
      const notifCutoff = new Date(Date.now() - notificationDays * 24 * 60 * 60 * 1000);
      const deletedNotif = await db.delete(notifications).where(lt(notifications.createdAt, notifCutoff)).returning({ id: notifications.id });
      console.log(`[LogRetention] Deleted ${deletedNotif.length} old notifications.`);

      // 4. Cleanup Expired Sessions
      // Delete sessions that are expired AND older than X days (safety buffer)
      // Actually strictly speaking we can delete any session where expiresAt < now() - buffer
      // Let's use the configured sessionDays as the buffer after expiration
      const sessionCutoff = new Date(Date.now() - sessionDays * 24 * 60 * 60 * 1000);
      const deletedSessions = await db.delete(sessions)
        .where(lt(sessions.expiresAt, sessionCutoff))
        .returning({ id: sessions.id });
      console.log(`[LogRetention] Deleted ${deletedSessions.length} expired sessions.`);

    } catch (error) {
      console.error('❌ [LogRetention] Cleanup failed:', error);
    }
  },

  /**
   * Helper to get config or default
   */
  async getConfig(key: string, defaultValue: number): Promise<number> {
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
    return config ? parseInt(config.value, 10) : defaultValue;
  },

  /**
   * Helper to set config
   */
  async setConfig(key: string, value: number) {
    await db.insert(systemConfig)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: systemConfig.key, set: { value: String(value), updatedAt: new Date() } });
  }
};
