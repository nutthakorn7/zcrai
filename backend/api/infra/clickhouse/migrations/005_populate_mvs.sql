-- ClickHouse Materialized Views with POPULATE for Historical Data
-- Drop existing empty views and recreate with data backfill

-- Drop existing views (they're empty anyway)
DROP VIEW IF EXISTS mv_dashboard_summary;
DROP VIEW IF EXISTS mv_dashboard_timeline;
DROP VIEW IF EXISTS mv_mitre_heatmap;
DROP VIEW IF EXISTS mv_top_hosts;
DROP VIEW IF EXISTS mv_top_users;

-- 1. Dashboard Summary (with POPULATE for historical data)
CREATE MATERIALIZED VIEW mv_dashboard_summary
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, source, severity)
POPULATE  -- ← This backfills historical data!
AS SELECT
  tenant_id,
  toDate(timestamp) as date,
  source,
  severity,
  count() as count
FROM security_events
GROUP BY tenant_id, date, source, severity;

-- 2. Dashboard Timeline
CREATE MATERIALIZED VIEW mv_dashboard_timeline
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, source)
POPULATE
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

-- 3. MITRE Heatmap
CREATE MATERIALIZED VIEW mv_mitre_heatmap
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, mitre_tactic, mitre_technique)
POPULATE
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

-- 4. Top Hosts
CREATE MATERIALIZED VIEW mv_top_hosts
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, host_ip)
POPULATE
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

-- 5. Top Users
CREATE MATERIALIZED VIEW mv_top_users
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, user_name)
POPULATE
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

-- Verify population
SELECT 'mv_dashboard_summary' as view_name, count() as row_count FROM mv_dashboard_summary
UNION ALL
SELECT 'mv_dashboard_timeline', count() FROM mv_dashboard_timeline
UNION ALL
SELECT 'mv_mitre_heatmap', count() FROM mv_mitre_heatmap
UNION ALL
SELECT 'mv_top_hosts', count() FROM mv_top_hosts
UNION ALL
SELECT 'mv_top_users', count() FROM mv_top_users;
