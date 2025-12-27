-- Backfill Historical Data for Tier 4 Materialized Views

-- 1. Populating mv_ingestion_compliance
INSERT INTO mv_ingestion_compliance
SELECT
    tenant_id,
    toDate(timestamp) as date,
    source,
    count() as event_count,
    sum(dateDiff('second', timestamp, collected_at)) as total_lag_seconds,
    min(timestamp) as first_event_time,
    max(timestamp) as last_event_time
FROM security_events
GROUP BY tenant_id, date, source;

-- 2. Initial Population for retention_stats (Current snapshot)
INSERT INTO retention_stats (date, table_name, partition_id, total_rows, total_bytes, active_parts)
SELECT 
    today() as date,
    table,
    partition,
    sum(rows),
    sum(bytes_on_disk),
    count()
FROM system.parts
WHERE database = 'zcrai' AND active
GROUP BY table, partition;
