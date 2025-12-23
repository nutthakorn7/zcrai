# ClickHouse Materialized View Management Runbook

This document provides instructions for managing, monitoring, and troubleshooting the multi-tiered Materialized View (MV) architecture in zcrAI.

## Architecture Overview

The architecture is divided into 5 tiers:
1. **Tier 1: Core Analytics**: High-performance dashboard summaries and timelines.
2. **Tier 2: Threat Intelligence**: MITRE ATT&CK coverage and binary IOC tracking.
3. **Tier 3: Operational Efficiency**: Host/User risk profiling and integration SLA monitoring.
4. **Tier 4: Compliance & Audit**: Storage metrics and ingestion continuity.
5. **Tier 5: Advanced Analytics (UEBA)**: First-seen entity registry and threat correlation.

---

## Standard Operations

### 1. Adding a New MV
- Always use `IF NOT EXISTS`.
- If the view uses aggregation, use `AggregatingMergeTree` or `SummingMergeTree`.
- Ensure `DateTime64(3)` compatibility for timestamps.
- Apply TTL for data governance (e.g., 90d, 180d, or 365d).

### 2. Backfilling Historical Data
To populate a new MV with existing data (e.g., from 6.17M raw events):
```sql
INSERT INTO mv_dest_table
SELECT ... 
FROM security_events
WHERE ...;
```
*Note: Use `JSONExtractString(raw, 'path')` fallback for missing columns in historical data.*

---

## Health Monitoring & Alerts

### 1. Ingestion Lag
**Alert Threshold:** > 60 minutes
**Query:**
```sql
SELECT
    'mv_dashboard_summary_v2' as view_name,
    max(timestamp) as raw_latest,
    (SELECT max(hour) FROM mv_dashboard_summary_v2) as mv_latest,
    dateDiff('minute', mv_latest, raw_latest) as lag_minutes
FROM security_events;
```

### 2. Data Quality (Null/Empty Tracking)
**Alert Threshold:** Empty `host_name` or `source` > 1% in last 24h.
**Query:**
```sql
SELECT
    count() as total,
    countIf(host_name = '') / total * 100 as host_empty_pct
FROM security_events
WHERE timestamp > now() - INTERVAL 1 DAY;
```

---

## Troubleshooting

### TTL Issues
- ClickHouse TTL expressions must result in `Date` or `DateTime`.
- For `DateTime64(3)`, use `toDateTime(column)`.
- For `AggregateFunction` columns (e.g., `minState`), use `finalizeAggregation(column)`.

### Materialized View Lag
If an MV falls behind:
1. Check the ClickHouse `system.errors` table.
2. Verify the `collected_at` vs `timestamp` spread using `mv_integration_health`.
3. If necessary, drop and recreate the MV with a manual `INSERT` from raw data.
