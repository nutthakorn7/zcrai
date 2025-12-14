import { db } from '../../infra/db';
import { systemConfig } from '../../infra/db/schema';
import { eq } from 'drizzle-orm';
import { clickhouse } from '../../infra/clickhouse/client';

export const RetentionService = {
  // Config Key
  CONFIG_KEY: 'retention_logs_days',
  DEFAULT_DAYS: 30,

  /**
   * Get retention period in days
   */
  async getRetentionDays(): Promise<number> {
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, this.CONFIG_KEY));

    return config ? parseInt(config.value, 10) : this.DEFAULT_DAYS;
  },

  /**
   * Update retention period
   */
  async updateRetentionDays(days: number) {
    if (days < 1) throw new Error('Retention days must be at least 1');

    await db
      .insert(systemConfig)
      .values({
        key: this.CONFIG_KEY,
        value: days.toString(),
        description: 'Days to retain security logs in ClickHouse',
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value: days.toString(),
          updatedAt: new Date()
        }
      });
      
    return days;
  },

  /**
   * Enforce retention policy: Delete logs older than X days
   */
  async enforceRetention() {
    console.log('🧹 Starting Log Retention Enforcement...');
    
    // 1. Get Config
    const days = await this.getRetentionDays();
    console.log(`📅 Retention Policy: ${days} days`);

    // 2. Calculate Cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Format for ClickHouse DateTime64 ('YYYY-MM-DD HH:mm:ss')
    const cutoffStr = cutoffDate.toISOString().replace('T', ' ').split('.')[0];

    console.log(`✂️ Deleting logs older than: ${cutoffStr}`);

    // 3. Execute Deletion (Async Mutation)
    // Note: mutations in ClickHouse are async.
    try {
        const query = `ALTER TABLE security_events DELETE WHERE timestamp < toDateTime64('${cutoffStr}', 3)`;
        
        await clickhouse.query({
            query: query,
            format: 'JSON'
        });
        
        console.log('✅ Deletion command sent to ClickHouse successfully.');
    } catch (error) {
        console.error('❌ Failed to enforce retention:', error);
        throw error;
    }
  }
};
