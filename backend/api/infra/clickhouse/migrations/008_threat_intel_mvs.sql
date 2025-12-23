-- Tier 2: Threat Intelligence MVs (IOC Tracking & MITRE Impact)
-- Enhanced with JSON fallbacks for historical data completeness

-- 1. File IOCs tracking with ReplacingMergeTree
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_file_iocs
ENGINE = ReplacingMergeTree(timestamp)
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, file_sha256)
AS SELECT
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

-- 2. Enhanced MITRE Coverage with Entity Impact
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mitre_coverage_v3
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, mitre_tactic, mitre_technique)
AS SELECT
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

-- 3. Process Baseline View
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_process_baseline
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, host_name, process_name, process_path)
AS SELECT
    tenant_id,
    toDate(timestamp) as date,
    host_name,
    if(process_name != '', process_name, JSONExtractString(raw, 'ThreatName')) as process_name,
    if(process_path != '', process_path, JSONExtractString(raw, 'FilePath')) as process_path,
    count() as execution_count
FROM security_events
WHERE (process_name != '' OR JSONExtractString(raw, 'ThreatName') != '')
GROUP BY tenant_id, date, host_name, process_name, process_path;
