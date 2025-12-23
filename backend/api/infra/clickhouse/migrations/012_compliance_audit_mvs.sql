-- Tier 4: Compliance & Audit MVs (Retention & Ingestion SLA)

-- 1. Retention & Storage Metrics
-- Tracks table size and row count per partition for capacity planning
-- Uses system.parts to get storage info
-- Note: MVs normally trigger on INSERT, but for system stats we use a different approach or a scheduled view
-- Here we'll create a standard view that can be queried, or a SummingMergeTree that we populate manually/via cron
CREATE TABLE IF NOT EXISTS zcrai.retention_stats (
    date Date,
    table_name String,
    partition_id String,
    total_rows UInt64,
    total_bytes UInt64,
    active_parts UInt32,
    timestamp DateTime DEFAULT now()
) ENGINE = SummingMergeTree
ORDER BY (date, table_name, partition_id);

-- 2. Ingestion Compliance SLA (Daily continuity & lag)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ingestion_compliance
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, source)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    source,
    count() as event_count,
    sum(dateDiff('second', timestamp, collected_at)) as total_lag_seconds,
    min(timestamp) as first_event_time,
    max(timestamp) as last_event_time
FROM security_events
GROUP BY tenant_id, date, source;
