-- ClickHouse Security Events Schema
-- Unified log storage สำหรับ SentinelOne, CrowdStrike และอื่นๆ

CREATE DATABASE IF NOT EXISTS zcr;

-- Main security events table
CREATE TABLE IF NOT EXISTS zcr.security_events
(
    -- Primary identifiers
    id String,
    tenant_id String,
    source LowCardinality(String), -- sentinelone, crowdstrike
    
    -- Time fields
    timestamp DateTime64(3),
    collected_at DateTime64(3),
    _time DateTime64(3) DEFAULT timestamp,
    
    -- Classification
    severity LowCardinality(String), -- critical, high, medium, low, info
    severity_score UInt8 DEFAULT 0,
    event_type LowCardinality(String), -- threat, detection, activity
    title String,
    description String,
    
    -- MITRE ATT&CK
    mitre_tactic LowCardinality(String) DEFAULT '',
    mitre_technique LowCardinality(String) DEFAULT '',
    
    -- Host info
    host_name String DEFAULT '',
    host_ip String DEFAULT '',
    host_os String DEFAULT '',
    host_os_version String DEFAULT '',
    host_agent_id String DEFAULT '',
    host_site_name String DEFAULT '',
    host_group_name String DEFAULT '',
    
    -- User info
    user_name String DEFAULT '',
    user_domain String DEFAULT '',
    user_email String DEFAULT '',
    
    -- Process info
    process_name String DEFAULT '',
    process_path String DEFAULT '',
    process_cmd String DEFAULT '',
    process_pid UInt32 DEFAULT 0,
    process_ppid UInt32 DEFAULT 0,
    process_sha256 String DEFAULT '',
    
    -- File info
    file_name String DEFAULT '',
    file_path String DEFAULT '',
    file_hash String DEFAULT '',
    file_sha256 String DEFAULT '',
    file_md5 String DEFAULT '',
    file_size UInt64 DEFAULT 0,
    
    -- Network info
    network_src_ip String DEFAULT '',
    network_dst_ip String DEFAULT '',
    network_src_port UInt16 DEFAULT 0,
    network_dst_port UInt16 DEFAULT 0,
    network_protocol LowCardinality(String) DEFAULT '',
    network_direction LowCardinality(String) DEFAULT '',
    network_bytes_sent UInt64 DEFAULT 0,
    network_bytes_recv UInt64 DEFAULT 0,
    
    -- Raw data
    raw String DEFAULT '', -- JSON string of original payload
    
    -- Metadata
    metadata String DEFAULT '' -- JSON string of additional metadata
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, timestamp, id)
TTL toDateTime(timestamp) + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;

-- Materialized view for dashboard summary (counts by severity per tenant per day)
CREATE MATERIALIZED VIEW IF NOT EXISTS zcr.security_events_daily_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, severity, source)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    severity,
    source,
    count() AS event_count
FROM zcr.security_events
GROUP BY tenant_id, date, severity, source;

-- Materialized view for top hosts
CREATE MATERIALIZED VIEW IF NOT EXISTS zcr.security_events_top_hosts_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, host_name)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    host_name,
    count() AS event_count,
    countIf(severity = 'critical') AS critical_count,
    countIf(severity = 'high') AS high_count
FROM zcr.security_events
WHERE host_name != ''
GROUP BY tenant_id, date, host_name;

-- Materialized view for MITRE heatmap
CREATE MATERIALIZED VIEW IF NOT EXISTS zcr.security_events_mitre_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, mitre_tactic, mitre_technique)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    mitre_tactic,
    mitre_technique,
    count() AS event_count
FROM zcr.security_events
WHERE mitre_tactic != '' OR mitre_technique != ''
GROUP BY tenant_id, date, mitre_tactic, mitre_technique;
