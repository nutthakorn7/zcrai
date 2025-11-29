-- Migration: Add Detection Details and Extended Fields
-- Date: 2024-11-30
-- Description: เพิ่ม fields สำคัญสำหรับแสดงผล Detection Details, Response, Attack Chain

-- ==================== Detection Details ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS rule_name String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS threat_name String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS classification String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS confidence_level String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS analyst_verdict LowCardinality(String) DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS incident_status LowCardinality(String) DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS detection_engines String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS classification_source LowCardinality(String) DEFAULT '';

-- ==================== MITRE ATT&CK Extended ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS mitre_attack_link String DEFAULT '';

-- ==================== Response/Disposition ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS threat_mitigated Bool DEFAULT false;
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS disposition_description String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS response_actions String DEFAULT '';

-- ==================== Console Link ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS console_link String DEFAULT '';

-- ==================== Storyline/Correlation ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS storyline String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS control_graph_id String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS incident_id_ref String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS alert_ids String DEFAULT '';

-- ==================== Extended Host Info ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_external_ip String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_mac_address String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_platform LowCardinality(String) DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_agent_version String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_account_id String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_account_name String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_site_id String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_group_id String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_domain String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_ou String DEFAULT '';

-- ==================== Extended Process Info ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS process_sha1 String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS process_md5 String DEFAULT '';

-- ==================== Parent Process (Attack Chain) ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS parent_process_name String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS parent_process_path String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS parent_process_cmd String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS parent_process_sha256 String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS parent_process_md5 String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS parent_process_user String DEFAULT '';

-- ==================== Grandparent Process (Attack Chain) ====================
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS grandparent_process_name String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS grandparent_process_path String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS grandparent_process_cmd String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS grandparent_process_sha256 String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS grandparent_process_md5 String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS grandparent_process_user String DEFAULT '';

-- ==================== New Materialized View: Analyst Verdicts ====================
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_verdicts_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, analyst_verdict, incident_status)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    analyst_verdict,
    incident_status,
    source,
    count() AS event_count
FROM zcrai.security_events
WHERE analyst_verdict != '' OR incident_status != ''
GROUP BY tenant_id, date, analyst_verdict, incident_status, source;

-- ==================== New Materialized View: Threat Classifications ====================
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_classifications_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, classification, threat_name)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    classification,
    threat_name,
    source,
    count() AS event_count,
    countIf(threat_mitigated = true) AS mitigated_count
FROM zcrai.security_events
WHERE classification != '' OR threat_name != ''
GROUP BY tenant_id, date, classification, threat_name, source;

-- ==================== New Materialized View: Response Actions Summary ====================
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_response_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, disposition_description)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    disposition_description,
    source,
    count() AS event_count,
    countIf(threat_mitigated = true) AS auto_mitigated
FROM zcrai.security_events
WHERE disposition_description != ''
GROUP BY tenant_id, date, disposition_description, source;

-- ==================== New Materialized View: Attack Chain (Process Tree) ====================
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_attack_chain_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, parent_process_name, process_name)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    parent_process_name,
    process_name,
    grandparent_process_name,
    count() AS event_count,
    countIf(severity = 'critical' OR severity = 'high') AS high_severity_count
FROM zcrai.security_events
WHERE parent_process_name != '' OR grandparent_process_name != ''
GROUP BY tenant_id, date, parent_process_name, process_name, grandparent_process_name;
