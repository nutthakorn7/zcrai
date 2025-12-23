-- Backfill Historical Data for Tier 3 Materialized Views

-- 1. Populating mv_top_hosts_v2
INSERT INTO mv_top_hosts_v2
SELECT
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

-- 2. Populating mv_top_users_v2
INSERT INTO mv_top_users_v2
SELECT
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

-- 3. Populating mv_integration_health
INSERT INTO mv_integration_health
SELECT
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
