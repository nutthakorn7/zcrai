-- Tier 1: Core Analytics Enhancement V2 (Hourly Granularity & Cardinality)

-- 1. Enhanced Dashboard Summary (Hourly severity counts)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_summary_v2
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, hour, source, severity)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    toStartOfHour(timestamp) as hour,
    source,
    severity,
    count() as event_count
FROM security_events
GROUP BY tenant_id, date, hour, source, severity;

-- 2. Enhanced Event Timeline (Hourly event type distribution)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_event_timeline_v2
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, hour, event_type, source)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    toStartOfHour(timestamp) as hour,
    event_type,
    source,
    count() as count,
    countIf(severity = 'critical') as critical_count,
    countIf(severity = 'high') as high_count
FROM security_events
GROUP BY tenant_id, date, hour, event_type, source;

-- 3. Unique Entity Tracking (Host & User cardinality per hour)
-- Uses AggregateMergeTree with uniqState for accurate merging
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_unique_entities
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, hour, source)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    toStartOfHour(timestamp) as hour,
    source,
    uniqState(host_name) as unique_hosts,
    uniqState(user_name) as unique_users,
    uniqState(network_src_ip) as unique_src_ips
FROM security_events
GROUP BY tenant_id, date, hour, source;
