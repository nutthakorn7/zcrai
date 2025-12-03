import { CronJob } from 'cron'
import { query } from '../../infra/clickhouse/client'

export const SchedulerService = {
  init() {
    console.log('[Scheduler] Initializing background jobs...')

    // Run optimization every 15 minutes (Safety net กรณี Collector ไม่ทำงาน)
    // "0 */15 * * * *"
    const optimizeJob = new CronJob(
      '0 */15 * * * *',
      async () => {
        await SchedulerService.optimizeDB()
      },
      null,
      true, // start immediately
      'Asia/Bangkok'
    )

    console.log('[Scheduler] Jobs scheduled: Optimize DB (Every 15 minutes)')
  },

  async optimizeDB() {
    console.log('[Scheduler] Running ClickHouse optimization...')
    try {
      // Deduplicate security_events table
      await query('OPTIMIZE TABLE zcrai.security_events FINAL DEDUPLICATE BY tenant_id, timestamp, id')
      console.log('[Scheduler] ClickHouse security_events optimized successfully')
    } catch (e) {
      console.error('[Scheduler] Failed to optimize ClickHouse:', e)
    }
  },

  // ฟังก์ชันสำหรับ Re-populate Materialized Views
  // ใช้เมื่อมีการลบข้อมูลหรือ Deduplicate จำนวนมาก เพื่อให้ MV ตรงกับ Table หลัก
  async repopulateMVs() {
    console.log('[Scheduler] Starting MV repopulation...')
    const mvs = [
      {
        name: 'zcrai.security_events_daily_mv',
        query: `INSERT INTO zcrai.security_events_daily_mv SELECT tenant_id, toDate(timestamp) AS date, severity, source, count() AS event_count FROM zcrai.security_events GROUP BY tenant_id, date, severity, source`
      },
      {
        name: 'zcrai.security_events_top_hosts_mv',
        query: `INSERT INTO zcrai.security_events_top_hosts_mv SELECT tenant_id, toDate(timestamp) AS date, source, host_name, count() AS event_count, countIf(severity = 'critical') AS critical_count, countIf(severity = 'high') AS high_count FROM zcrai.security_events WHERE host_name != '' GROUP BY tenant_id, date, source, host_name`
      },
      {
        name: 'zcrai.security_events_mitre_mv',
        query: `INSERT INTO zcrai.security_events_mitre_mv SELECT tenant_id, toDate(timestamp) AS date, source, mitre_tactic, mitre_technique, count() AS event_count FROM zcrai.security_events WHERE mitre_tactic != '' OR mitre_technique != '' GROUP BY tenant_id, date, source, mitre_tactic, mitre_technique`
      },
      {
        name: 'zcrai.security_events_integration_mv',
        query: `INSERT INTO zcrai.security_events_integration_mv SELECT tenant_id, toDate(timestamp) AS date, integration_id, integration_name, source, count() AS event_count, countIf(severity = 'critical') AS critical_count, countIf(severity = 'high') AS high_count FROM zcrai.security_events GROUP BY tenant_id, date, integration_id, integration_name, source`
      },
      {
        // Sites MV - รองรับทุก source (S1 sites, CrowdStrike MSSP sites)
        name: 'zcrai.security_events_sites_mv',
        query: `INSERT INTO zcrai.security_events_sites_mv SELECT tenant_id, toDate(timestamp) AS date, source, host_account_id, host_account_name, host_site_id, host_site_name, count() AS event_count, countIf(severity = 'critical') AS critical_count, countIf(severity = 'high') AS high_count FROM zcrai.security_events WHERE host_site_name != '' GROUP BY tenant_id, date, source, host_account_id, host_account_name, host_site_id, host_site_name`
      }
    ]

    for (const mv of mvs) {
      try {
        console.log(`[Scheduler] Repopulating ${mv.name}...`)
        await query(`TRUNCATE TABLE ${mv.name}`)
        await query(mv.query)
        console.log(`[Scheduler] ${mv.name} repopulated successfully`)
      } catch (e) {
        console.error(`[Scheduler] Failed to repopulate ${mv.name}:`, e)
      }
    }
    console.log('[Scheduler] MV repopulation completed')
  }
}
