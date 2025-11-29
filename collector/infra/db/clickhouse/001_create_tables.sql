-- ClickHouse Security Events Schema
-- Unified log storage สำหรับ SentinelOne, CrowdStrike และอื่นๆ

CREATE DATABASE IF NOT EXISTS zcrai;

-- Main security events table
CREATE TABLE IF NOT EXISTS zcrai.security_events
(
    -- Primary identifiers
    id String,
    tenant_id String,
    integration_id String DEFAULT '',      -- zcrAI Integration ID
    integration_name String DEFAULT '',    -- ชื่อ Integration
    source LowCardinality(String),         -- sentinelone, crowdstrike
    
    -- Time fields
    timestamp DateTime64(3),
    collected_at DateTime64(3),
    _time DateTime64(3) DEFAULT timestamp,
    
    -- Classification
    severity LowCardinality(String),       -- critical, high, medium, low, info
    severity_score UInt8 DEFAULT 0,
    event_type LowCardinality(String),     -- threat, detection, activity, alert, incident
    title String,
    description String,
    
    -- ==================== Detection Details ====================
    rule_name String DEFAULT '',
    threat_name String DEFAULT '',
    classification String DEFAULT '',
    confidence_level String DEFAULT '',
    analyst_verdict LowCardinality(String) DEFAULT '',
    incident_status LowCardinality(String) DEFAULT '',
    detection_engines String DEFAULT '',
    classification_source LowCardinality(String) DEFAULT '',

    -- ==================== MITRE ATT&CK ====================
    mitre_tactic LowCardinality(String) DEFAULT '',
    mitre_technique LowCardinality(String) DEFAULT '',
    mitre_attack_link String DEFAULT '',

    -- ==================== Response/Disposition ====================
    threat_mitigated Bool DEFAULT false,
    disposition_description String DEFAULT '',
    response_actions String DEFAULT '',

    -- ==================== Console Link ====================
    console_link String DEFAULT '',

    -- ==================== Storyline/Correlation ====================
    storyline String DEFAULT '',
    control_graph_id String DEFAULT '',
    incident_id_ref String DEFAULT '',
    alert_ids String DEFAULT '',
    
    -- ==================== Host Info (Extended) ====================
    host_name String DEFAULT '',
    host_ip String DEFAULT '',
    host_external_ip String DEFAULT '',
    host_mac_address String DEFAULT '',
    host_os String DEFAULT '',
    host_os_version String DEFAULT '',
    host_platform LowCardinality(String) DEFAULT '',
    host_agent_id String DEFAULT '',
    host_agent_version String DEFAULT '',
    host_account_id String DEFAULT '',
    host_account_name String DEFAULT '',
    host_site_id String DEFAULT '',
    host_site_name String DEFAULT '',
    host_group_id String DEFAULT '',
    host_group_name String DEFAULT '',
    host_domain String DEFAULT '',
    host_ou String DEFAULT '',
    
    -- ==================== User Info ====================
    user_name String DEFAULT '',
    user_domain String DEFAULT '',
    user_email String DEFAULT '',
    
    -- ==================== Process Info ====================
    process_name String DEFAULT '',
    process_path String DEFAULT '',
    process_cmd String DEFAULT '',
    process_pid UInt32 DEFAULT 0,
    process_ppid UInt32 DEFAULT 0,
    process_sha256 String DEFAULT '',
    process_sha1 String DEFAULT '',
    process_md5 String DEFAULT '',

    -- ==================== Parent Process (Attack Chain) ====================
    parent_process_name String DEFAULT '',
    parent_process_path String DEFAULT '',
    parent_process_cmd String DEFAULT '',
    parent_process_sha256 String DEFAULT '',
    parent_process_md5 String DEFAULT '',
    parent_process_user String DEFAULT '',

    -- ==================== Grandparent Process (Attack Chain) ====================
    grandparent_process_name String DEFAULT '',
    grandparent_process_path String DEFAULT '',
    grandparent_process_cmd String DEFAULT '',
    grandparent_process_sha256 String DEFAULT '',
    grandparent_process_md5 String DEFAULT '',
    grandparent_process_user String DEFAULT '',
    
    -- ==================== File Info ====================
    file_name String DEFAULT '',
    file_path String DEFAULT '',
    file_hash String DEFAULT '',
    file_sha256 String DEFAULT '',
    file_md5 String DEFAULT '',
    file_size UInt64 DEFAULT 0,
    
    -- ==================== Network Info ====================
    network_src_ip String DEFAULT '',
    network_dst_ip String DEFAULT '',
    network_src_port UInt16 DEFAULT 0,
    network_dst_port UInt16 DEFAULT 0,
    network_protocol LowCardinality(String) DEFAULT '',
    network_direction LowCardinality(String) DEFAULT '',
    network_bytes_sent UInt64 DEFAULT 0,
    network_bytes_recv UInt64 DEFAULT 0,
    
    -- ==================== Raw Data ====================
    raw String DEFAULT '',      -- JSON string of original payload
    metadata String DEFAULT ''  -- JSON string of additional metadata
)
ENGINE = ReplacingMergeTree(collected_at)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, timestamp, id)
TTL toDateTime(timestamp) + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;

-- Materialized view for dashboard summary (counts by severity per tenant per day)
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_daily_mv
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
FROM zcrai.security_events
GROUP BY tenant_id, date, severity, source;

-- Materialized view for top hosts
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_top_hosts_mv
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
FROM zcrai.security_events
WHERE host_name != ''
GROUP BY tenant_id, date, host_name;

-- Materialized view for MITRE heatmap
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_mitre_mv
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
FROM zcrai.security_events
WHERE mitre_tactic != '' OR mitre_technique != ''
GROUP BY tenant_id, date, mitre_tactic, mitre_technique;
