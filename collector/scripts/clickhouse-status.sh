#!/bin/bash
# =============================================================================
# ClickHouse Status Check Script
# ใช้ดูสถานะข้อมูลใน ClickHouse
# =============================================================================

CONTAINER="zcrai-clickhouse"
DATABASE="zcrai"

echo "📊 ClickHouse Data Status"
echo "========================="
echo ""

# Total events
TOTAL=$(docker exec $CONTAINER clickhouse-client --query "SELECT count() FROM $DATABASE.security_events")
echo "📈 Total Events: $TOTAL"
echo ""

# Events by source
echo "📂 By Source:"
docker exec $CONTAINER clickhouse-client --query "
SELECT 
    source, 
    count() as count,
    min(timestamp) as oldest,
    max(timestamp) as newest
FROM $DATABASE.security_events 
GROUP BY source
FORMAT PrettyCompact
"

echo ""
echo "🔥 By Severity:"
docker exec $CONTAINER clickhouse-client --query "
SELECT 
    severity, 
    count() as count
FROM $DATABASE.security_events 
GROUP BY severity
ORDER BY count DESC
FORMAT PrettyCompact
"

echo ""
echo "🏢 By Tenant:"
docker exec $CONTAINER clickhouse-client --query "
SELECT 
    tenant_id, 
    count() as count
FROM $DATABASE.security_events 
GROUP BY tenant_id
FORMAT PrettyCompact
"

echo ""
echo "📅 Events per Day (last 7 days):"
docker exec $CONTAINER clickhouse-client --query "
SELECT 
    toDate(timestamp) as date, 
    count() as count
FROM $DATABASE.security_events 
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY date
ORDER BY date DESC
FORMAT PrettyCompact
"
