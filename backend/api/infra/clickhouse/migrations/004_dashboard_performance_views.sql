-- ClickHouse Performance Optimization - Dashboard Queries
-- Fixed syntax: Remove () from engine names

-- 1. Materialized View for Summary (by severity)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_summary
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, source, severity)
AS SELECT
  tenant_id,
  toDate(timestamp) as date,
  source,
  severity,
  count() as count
FROM security_events
GROUP BY tenant_id, date, source, severity;

-- 2. Materialized View for Timeline (hourly/daily aggregations)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_timeline
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, source)
AS SELECT
  tenant_id,
  toDate(timestamp) as date,
  source,
  count() as total_count,
  countIf(severity = 'critical') as critical_count,
  countIf(severity = 'high') as high_count,
  countIf(severity = 'medium') as medium_count,
  countIf(severity = 'low') as low_count,
  countIf(severity = 'info') as info_count
FROM security_events
GROUP BY tenant_id, date, source;

-- 3. Materialized View for MITRE Heatmap
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mitre_heatmap
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, mitre_tactic, mitre_technique)
AS SELECT
  tenant_id,
  toDate(timestamp) as date,
  mitre_tactic,
  mitre_technique,
  source,
  count() as count
FROM security_events
WHERE mitre_tactic != '' AND mitre_technique != ''
GROUP BY tenant_id, date, mitre_tactic, mitre_technique, source;

-- 4. Materialized View for Top Hosts
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_hosts
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, host_ip)
AS SELECT
  tenant_id,
  toDate(timestamp) as date,
  host_ip,
  source,
  count() as count,
  countIf(severity = 'critical') as critical_count,
  countIf(severity = 'high') as high_count
FROM security_events
WHERE host_ip != ''
GROUP BY tenant_id, date, host_ip, source;

-- 5. Materialized View for Top Users
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_users
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, user_name)
AS SELECT
  tenant_id,
  toDate(timestamp) as date,
  user_name,
  source,
  count() as count,
  countIf(severity = 'critical') as critical_count,
  countIf(severity = 'high') as high_count
FROM security_events
WHERE user_name != ''
GROUP BY tenant_id, date, user_name, source;

-- Verify materialized views were created
SHOW TABLES LIKE 'mv_%';

-- Check data in materialized views (should populate automatically from existing data)
SELECT count() FROM mv_dashboard_summary;
SELECT count() FROM mv_dashboard_timeline;
SELECT count() FROM mv_mitre_heatmap;

-- Example query using materialized view (much faster!)
SELECT 
  severity,
  sum(count) as total
FROM mv_dashboard_summary
WHERE tenant_id = 'some-tenant-id'
  AND date >= '2025-12-01'
  AND date <= '2025-12-23'
GROUP BY severity;
