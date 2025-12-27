-- Tier 3: Operational Efficiency MVs (Entity Risk & Integration Health)

-- 1. Enhanced Top Hosts (Daily risk context)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_hosts_v2
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, host_name)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    host_name,
    source,
    count() as total_events,
    countIf(event_type = 'threat') as threat_count,
    countIf(severity = 'critical') as critical_count,
    countIf(severity = 'high') as high_count,
    uniqState(user_name) as unique_users
FROM security_events
WHERE host_name != ''
GROUP BY tenant_id, date, host_name, source;

-- 2. Enhanced Top Users (Daily risk & lateral movement context)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_users_v2
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, user_name)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    user_name,
    source,
    count() as total_events,
    countIf(event_type = 'threat') as threat_count,
    countIf(severity = 'critical') as critical_count,
    countIf(severity = 'high') as high_count,
    uniqState(host_name) as unique_hosts
FROM security_events
WHERE user_name != ''
GROUP BY tenant_id, date, user_name, source;

-- 3. Integration Health Monitoring (Hourly performance & latency)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_integration_health
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, hour, source, integration_id)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    toStartOfHour(timestamp) as hour,
    source,
    integration_id,
    count() as event_count,
    sum(dateDiff('second', timestamp, collected_at)) as total_latency_seconds,
    max(dateDiff('second', timestamp, collected_at)) as max_latency_seconds
FROM security_events
GROUP BY tenant_id, date, hour, source, integration_id;
