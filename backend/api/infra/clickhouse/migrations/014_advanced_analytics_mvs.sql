-- Tier 5: Advanced Analytics MVs (UEBA & Correlation)
-- Corrected for DateTime64(3) compatibility and UNION limitations

-- 1. Destination Table for First Seen Entities
CREATE TABLE IF NOT EXISTS entity_first_seen (
    tenant_id String,
    entity_type String,
    entity_value String,
    first_seen AggregateFunction(min, DateTime64(3)),
    last_seen AggregateFunction(max, DateTime64(3))
) ENGINE = AggregatingMergeTree
ORDER BY (tenant_id, entity_type, entity_value);

-- 1a. MV for Hosts
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_first_seen_hosts 
TO entity_first_seen
AS SELECT
    tenant_id,
    'host' as entity_type,
    host_name as entity_value,
    minState(timestamp) as first_seen,
    maxState(timestamp) as last_seen
FROM security_events
WHERE host_name != ''
GROUP BY tenant_id, entity_type, entity_value;

-- 1b. MV for Users
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_first_seen_users
TO entity_first_seen
AS SELECT
    tenant_id,
    'user' as entity_type,
    user_name as entity_value,
    minState(timestamp) as first_seen,
    maxState(timestamp) as last_seen
FROM security_events
WHERE user_name != ''
GROUP BY tenant_id, entity_type, entity_value;

-- 1c. MV for IPs
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_first_seen_ips
TO entity_first_seen
AS SELECT
    tenant_id,
    'ip' as entity_type,
    network_src_ip as entity_value,
    minState(timestamp) as first_seen,
    maxState(timestamp) as last_seen
FROM security_events
WHERE network_src_ip != ''
GROUP BY tenant_id, entity_type, entity_value;

-- 2. User Behavior Profiling (Hourly Activity)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_behavior
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, hour, user_name)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    toStartOfHour(timestamp) as hour,
    user_name,
    uniqState(host_name) as unique_hosts,
    uniqState(process_name) as unique_processes,
    uniqState(network_dst_ip) as unique_destinations,
    countState() as activity_count
FROM security_events
WHERE user_name != ''
GROUP BY tenant_id, date, hour, user_name;

-- 3. Multi-Stage Threat Correlation (1-Hour Window)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_threat_correlation
ENGINE = AggregatingMergeTree -- Changed to Aggregating to support groupUniqArrayState correctly
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, hour, host_name, user_name)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    toStartOfHour(timestamp) as hour,
    host_name,
    user_name,
    countIfState(event_type = 'threat') as threat_count,
    groupUniqArrayState(mitre_technique) as techniques,
    groupUniqArrayState(severity) as severities
FROM security_events
WHERE event_type = 'threat' OR severity IN ('high', 'critical')
GROUP BY tenant_id, date, hour, host_name, user_name;
