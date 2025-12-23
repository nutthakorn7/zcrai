-- ClickHouse Infrastructure & Operations: Health Monitoring Queries

-- 1. Ingestion Lag Monitor (Raw vs MVs)
-- Compares timestamp in raw events with those aggregated in MVs to detect lag
SELECT
    'mv_dashboard_summary_v2' as view_name,
    max(timestamp) as raw_latest,
    (SELECT max(hour) FROM mv_dashboard_summary_v2) as mv_latest,
    dateDiff('minute', mv_latest, raw_latest) as lag_minutes
FROM security_events
FORMAT Vertical;

-- 2. Data Quality Monitor (Empty values in critical columns)
SELECT
    count() as total_rows,
    countIf(host_name = '') as empty_hosts,
    countIf(user_name = '') as empty_users,
    countIf(source = '') as empty_sources
FROM security_events
WHERE timestamp > now() - INTERVAL 1 DAY;

-- 3. Storage Forecast (Partition growth)
SELECT
    table_name,
    partition_id,
    total_rows,
    formatReadableSize(total_bytes) as size_on_disk,
    active_parts
FROM retention_stats
WHERE date = today()
ORDER BY total_bytes DESC;

-- 4. MV Health (Inner ID matching and structure)
SELECT
    name,
    engine,
    total_rows,
    formatReadableSize(total_bytes) as size
FROM system.tables
WHERE database = 'zcrai' AND name LIKE 'mv_%';
