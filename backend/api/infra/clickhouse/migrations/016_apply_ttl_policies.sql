-- ClickHouse Infrastructure & Operations: Apply TTL Policies

-- Tier: Compliance (365 Days)
-- TTL MUST result in Date or DateTime (DateTime64 not allowed for the final expression in some versions)
ALTER TABLE zcrai.entity_first_seen MODIFY TTL toDateTime(finalizeAggregation(last_seen) + toIntervalDay(365));
ALTER TABLE zcrai.mv_ingestion_compliance MODIFY TTL toDateTime(date + toIntervalDay(365));
ALTER TABLE zcrai.retention_stats MODIFY TTL toDateTime(date + toIntervalDay(365));

-- 2. Tier: Analytics (180 Days)
ALTER TABLE zcrai.mv_dashboard_summary_v2 MODIFY TTL toDateTime(date + toIntervalDay(180));
ALTER TABLE zcrai.mv_event_timeline_v2 MODIFY TTL toDateTime(date + toIntervalDay(180));
ALTER TABLE zcrai.mv_unique_entities MODIFY TTL toDateTime(date + toIntervalDay(180));
ALTER TABLE zcrai.mv_mitre_coverage_v3 MODIFY TTL toDateTime(date + toIntervalDay(180));
ALTER TABLE zcrai.mv_user_behavior MODIFY TTL toDateTime(date + toIntervalDay(180));

-- 3. Tier: Operational (90 Days)
ALTER TABLE zcrai.mv_file_iocs MODIFY TTL toDateTime(date + toIntervalDay(90));
ALTER TABLE zcrai.mv_process_baseline MODIFY TTL toDateTime(date + toIntervalDay(90));
ALTER TABLE zcrai.mv_threat_correlation MODIFY TTL toDateTime(date + toIntervalDay(90));
