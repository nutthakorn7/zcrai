-- Migration: Add sites MV for all sources (replaces S1-only MV)
-- รองรับทั้ง SentinelOne และ CrowdStrike MSSP sites

-- Drop old S1-specific MV if exists
DROP TABLE IF EXISTS zcrai.security_events_s1_tenant_mv;

-- Create new generic sites MV
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_sites_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, source, host_site_name)
AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    source,
    host_account_id,
    host_account_name,
    host_site_id,
    host_site_name,
    count() AS event_count,
    countIf(severity = 'critical') AS critical_count,
    countIf(severity = 'high') AS high_count
FROM zcrai.security_events
WHERE host_site_name != ''
GROUP BY tenant_id, date, source, host_account_id, host_account_name, host_site_id, host_site_name;
