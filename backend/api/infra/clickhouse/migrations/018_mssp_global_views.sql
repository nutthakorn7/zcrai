-- Phase 14: MSSP Global Analytics & Cross-Tenant Visibility
-- This table and MV provide a "Bird's Eye View" of all tenants for the MSSP SuperAdmin.

-- 1. Destination table for global overview stats (AggregatingMergeTree)
CREATE TABLE IF NOT EXISTS mssp_global_overview (
    date Date,
    tenant_id String,
    total_events SimpleAggregateFunction(sum, UInt64),
    critical_alerts SimpleAggregateFunction(sum, UInt64),
    active_hosts SimpleAggregateFunction(sum, UInt64),
    total_gb SimpleAggregateFunction(sum, Float64)
) ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(date)
ORDER BY (date, tenant_id);

-- 2. Materialized View to populate global overview
-- This summarizes data per tenant per day for the global command center
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mssp_global_overview
TO mssp_global_overview
AS SELECT
    toDate(timestamp) as date,
    tenant_id,
    count() as total_events,
    countIf(severity = 'critical') as critical_alerts,
    uniq(host_name) as active_hosts,
    sum(length(CAST(this, 'String'))) / 1024 / 1024 / 1024 as total_gb
FROM security_events
GROUP BY date, tenant_id;

-- 3. Add Bloom Filter Indexes to the main security_events table for faster tenant lookups 
-- This helps when searching for an IOC across the entire MSSP customer base.
ALTER TABLE security_events ADD INDEX idx_tenant_id tenant_id TYPE bloom_filter GRANULARITY 1;
ALTER TABLE security_events MATERIALIZE INDEX idx_tenant_id;

-- 4. Initial Backfill (Populate MV for the last 30 days)
INSERT INTO mssp_global_overview
SELECT
    toDate(timestamp) as date,
    tenant_id,
    count(),
    countIf(severity = 'critical'),
    uniq(host_name),
    sum(length(CAST(this, 'String'))) / 1024 / 1024 / 1024
FROM security_events
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY date, tenant_id;
