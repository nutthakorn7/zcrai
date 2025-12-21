---
description: Troubleshooting Log Ingestion (CrowdStrike/SentinelOne -> Vector -> ClickHouse)
---

# Troubleshooting Log Ingestion

This guide helps diagnose and fix issues where logs from integrations (SentinelOne, CrowdStrike) are not appearing in the Dashboard/Alerts page.

## 1. Check Ingestion Status in ClickHouse

Run this command on the server to see real-time event counts:

```bash
# SSH into server
ssh zcrAI

# Query ClickHouse event counts by source
curl -s 'http://default:clickhouse@localhost:8123/?database=zcrai' --data "SELECT count() as total, max(timestamp) as latest, source FROM security_events GROUP BY source ORDER BY total DESC"
```

**Expected Output:**
You should see rows for `sentinelone` and `crowdstrike` with increasing counts and recent timestamps.

## 2. Debugging CrowdStrike Ingestion

If CrowdStrike events are 0 or not increasing:

### A. Check API Scopes
Ensure the API Client in CrowdStrike Falcon Console has the following scopes:
- **Detections**: Read
- **Alerts**: Read
- **Incidents**: Read
- **Hosts**: Read

### B. Check Collector Logs
View the collector logs to see API errors or fetch status:

```bash
docker logs zcrai_collector 2>&1 | grep -iE 'crowdstrike|alert|fetch' | tail -20
```

### C. Force Full Sync (Reset State)
If you need to re-fetch historical data (e.g., missed alerts due to scope issues):

1. **Reset Checkpoint in Database:**
   ```bash
   psql postgres://postgres:postgres@localhost:5432/zcrai -c "UPDATE collector_states SET checkpoint = NULL, full_sync_complete = false WHERE provider = 'crowdstrike';"
   ```

2. **Trigger Sync via API:**
   ```bash
   # Replace with your actual Collector API Key
   curl -s -X POST -H 'x-collector-key: zcrAI_super_secure_collector_key_2024' 'http://localhost:8001/sync/crowdstrike?force=true'
   ```

3. **(Optional) Force Historical Lookback:**
   If the config is set to 7 days but you need 365 days, update the `FetchSettings` in the configuration JSON (via UI or DB) or verify `lookbackDays` in `vector.toml` / env vars.

## 3. Debugging Vector & Schema Issues

If the collector is fetching events (logs show `Published events to Vector`) but they aren't in ClickHouse:

1. **Check Vector Status:**
   ```bash
   docker logs zcrai_vector
   ```
   Look for `400 Bad Request` or `parsing error`.

2. **Common Causes:**
   - **Timestamp Mismatch:** ClickHouse `DateTime` doesn't support milliseconds. Ensure formatting is `%Y-%m-%d %H:%M:%S`.
   - **UUID Mismatch:** ClickHouse `UUID` columns must receive valid UUID strings. If the source sends an integer/string ID, exclude it in Vector transform and let ClickHouse auto-generate, or parse it correctly.
   - **Extra Fields:** Ensure `skip_unknown_fields = true` is set in Vector sink config, or map fields explicitly.
