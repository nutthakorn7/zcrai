-- Backfill Historical Data for Tier 5 Materialized Views

-- 1. Populating entity_first_seen
INSERT INTO entity_first_seen
SELECT
    tenant_id,
    'host' as entity_type,
    host_name as entity_value,
    minState(timestamp) as first_seen,
    maxState(timestamp) as last_seen
FROM security_events
WHERE host_name != ''
GROUP BY tenant_id, entity_type, entity_value;

INSERT INTO entity_first_seen
SELECT
    tenant_id,
    'user' as entity_type,
    user_name as entity_value,
    minState(timestamp) as first_seen,
    maxState(timestamp) as last_seen
FROM security_events
WHERE user_name != ''
GROUP BY tenant_id, entity_type, entity_value;

INSERT INTO entity_first_seen
SELECT
    tenant_id,
    'ip' as entity_type,
    network_src_ip as entity_value,
    minState(timestamp) as first_seen,
    maxState(timestamp) as last_seen
FROM security_events
WHERE network_src_ip != ''
GROUP BY tenant_id, entity_type, entity_value;

-- 2. Populating mv_user_behavior
INSERT INTO mv_user_behavior
SELECT
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

-- 3. Populating mv_threat_correlation
INSERT INTO mv_threat_correlation
SELECT
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
