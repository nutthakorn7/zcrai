-- Backfill Historical Data for New Materialized Views

-- 1. Populating mv_dashboard_summary_v2
INSERT INTO mv_dashboard_summary_v2
SELECT
    tenant_id,
    toDate(timestamp) as date,
    toStartOfHour(timestamp) as hour,
    source,
    severity,
    count() as event_count
FROM security_events
GROUP BY tenant_id, date, hour, source, severity;

-- 2. Populating mv_event_timeline_v2
INSERT INTO mv_event_timeline_v2
SELECT
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

-- 3. Populating mv_unique_entities
INSERT INTO mv_unique_entities
SELECT
    tenant_id,
    toDate(timestamp) as date,
    toStartOfHour(timestamp) as hour,
    source,
    uniqState(host_name) as unique_hosts,
    uniqState(user_name) as unique_users,
    uniqState(network_src_ip) as unique_src_ips
FROM security_events
GROUP BY tenant_id, date, hour, source;

-- 4. Populating mv_file_iocs with JSON fallback
INSERT INTO mv_file_iocs
SELECT
    id,
    tenant_id,
    toDate(timestamp) as date,
    timestamp,
    if(file_name != '', file_name, JSONExtractString(raw, 'ThreatName')) as file_name,
    if(file_path != '', file_path, JSONExtractString(raw, 'FilePath')) as file_path,
    if(file_sha256 != '', file_sha256, JSONExtractString(raw, 'FileHash')) as file_sha256,
    if(file_md5 != '', file_md5, JSONExtractString(raw, 'MD5')) as file_md5,
    host_name,
    source,
    severity
FROM security_events
WHERE (file_sha256 != '' OR JSONExtractString(raw, 'FileHash') != '')
  AND (file_sha256 != '0' AND JSONExtractString(raw, 'FileHash') != '0');

-- 5. Populating mv_mitre_coverage_v3
INSERT INTO mv_mitre_coverage_v3
SELECT
    tenant_id,
    toDate(timestamp) as date,
    mitre_tactic,
    mitre_technique,
    source,
    countState() as event_count,
    uniqState(host_name) as unique_hosts,
    uniqState(user_name) as unique_users
FROM security_events
WHERE mitre_tactic != ''
GROUP BY tenant_id, date, mitre_tactic, mitre_technique, source;

-- 6. Populating mv_process_baseline with JSON fallback
INSERT INTO mv_process_baseline
SELECT
    tenant_id,
    toDate(timestamp) as date,
    host_name,
    if(process_name != '', process_name, JSONExtractString(raw, 'ThreatName')) as process_name,
    if(process_path != '', process_path, JSONExtractString(raw, 'FilePath')) as process_path,
    count() as execution_count
FROM security_events
WHERE (process_name != '' OR JSONExtractString(raw, 'ThreatName') != '')
GROUP BY tenant_id, date, host_name, process_name, process_path;
