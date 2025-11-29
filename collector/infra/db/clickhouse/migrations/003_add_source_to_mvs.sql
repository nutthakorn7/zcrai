-- Migration: Add source column to MVs that are missing it
-- This improves filtering performance by allowing source-based queries on MVs
-- Run manually: clickhouse-client < 003_add_source_to_mvs.sql

-- =====================================================
-- 1. DROP existing MVs (that need modification)
-- =====================================================

DROP TABLE IF EXISTS zcrai.security_events_top_hosts_mv;
DROP TABLE IF EXISTS zcrai.security_events_mitre_mv;

-- =====================================================
-- 2. CREATE new MVs with source column
-- =====================================================

-- Top Hosts MV (เพิ่ม source column)
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_top_hosts_mv
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, date, source, host_name)
AS SELECT 
    tenant_id,
    toDate(timestamp) AS date,
    source,
    host_name,
    count() AS event_count,
    countIf(severity = 'critical') AS critical_count,
    countIf(severity = 'high') AS high_count
FROM zcrai.security_events
WHERE host_name != ''
GROUP BY tenant_id, date, source, host_name;

-- MITRE MV (เพิ่ม source column)
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.security_events_mitre_mv
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, date, source, mitre_tactic, mitre_technique)
AS SELECT 
    tenant_id,
    toDate(timestamp) AS date,
    source,
    mitre_tactic,
    mitre_technique,
    count() AS event_count
FROM zcrai.security_events
WHERE mitre_tactic != '' OR mitre_technique != ''
GROUP BY tenant_id, date, source, mitre_tactic, mitre_technique;

-- =====================================================
-- 3. Populate MVs with existing data
-- =====================================================

INSERT INTO zcrai.security_events_top_hosts_mv 
SELECT 
    tenant_id,
    toDate(timestamp) AS date,
    source,
    host_name,
    count() AS event_count,
    countIf(severity = 'critical') AS critical_count,
    countIf(severity = 'high') AS high_count
FROM zcrai.security_events
WHERE host_name != ''
GROUP BY tenant_id, date, source, host_name;

INSERT INTO zcrai.security_events_mitre_mv 
SELECT 
    tenant_id,
    toDate(timestamp) AS date,
    source,
    mitre_tactic,
    mitre_technique,
    count() AS event_count
FROM zcrai.security_events
WHERE mitre_tactic != '' OR mitre_technique != ''
GROUP BY tenant_id, date, source, mitre_tactic, mitre_technique;

-- Done!
