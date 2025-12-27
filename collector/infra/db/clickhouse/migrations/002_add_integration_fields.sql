-- Migration: Add Integration and S1 Tenant fields
-- เพิ่ม columns สำหรับเก็บ Integration info และ S1 Account/Site/Group IDs

-- Add Integration fields (zcrAI)
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS integration_id String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS integration_name String DEFAULT '';

-- Add S1 Account/Site/Group ID fields
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_account_id String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_account_name String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_site_id String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_site_name String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_group_id String DEFAULT '';
ALTER TABLE zcrai.security_events ADD COLUMN IF NOT EXISTS host_group_name String DEFAULT '';

-- Create Materialized View for Integration summary
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_integration_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, integration_id, integration_name)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    integration_id,
    integration_name,
    source,
    count() AS event_count,
    countIf(severity = 'critical') AS critical_count,
    countIf(severity = 'high') AS high_count
FROM zcrai.security_events
GROUP BY tenant_id, date, integration_id, integration_name, source;

-- Create Materialized View for S1 Account/Site summary
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_s1_tenant_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, host_account_name, host_site_name)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    host_account_id,
    host_account_name,
    host_site_id,
    host_site_name,
    count() AS event_count,
    countIf(severity = 'critical') AS critical_count,
    countIf(severity = 'high') AS high_count
FROM zcrai.security_events
WHERE source = 'sentinelone'
GROUP BY tenant_id, date, host_account_id, host_account_name, host_site_id, host_site_name;
