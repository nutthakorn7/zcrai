#!/bin/bash
# =============================================================================
# ClickHouse Data Cleanup Script
# ใช้สำหรับล้างข้อมูลทั้งหมดใน ClickHouse เพื่อ test ใหม่
# =============================================================================

CONTAINER="zcrai-clickhouse"
DATABASE="zcrai"

echo "🗑️  Truncating ClickHouse tables..."

# Truncate main table
echo "   → security_events"
docker exec $CONTAINER clickhouse-client --query "TRUNCATE TABLE $DATABASE.security_events"

# Truncate materialized views
echo "   → security_events_daily_mv"
docker exec $CONTAINER clickhouse-client --query "TRUNCATE TABLE $DATABASE.security_events_daily_mv" 2>/dev/null

echo "   → security_events_top_hosts_mv"
docker exec $CONTAINER clickhouse-client --query "TRUNCATE TABLE $DATABASE.security_events_top_hosts_mv" 2>/dev/null

echo "   → security_events_mitre_mv"
docker exec $CONTAINER clickhouse-client --query "TRUNCATE TABLE $DATABASE.security_events_mitre_mv" 2>/dev/null

# Verify
echo ""
echo "📊 Verifying counts:"
COUNT=$(docker exec $CONTAINER clickhouse-client --query "SELECT count() FROM $DATABASE.security_events")
echo "   security_events: $COUNT"

# Reset collector state
STATE_FILE="./data/state.json"
if [ -f "$STATE_FILE" ]; then
    echo ""
    echo "🔄 Resetting collector state..."
    echo '{}' > "$STATE_FILE"
    echo "   State file reset: $STATE_FILE"
fi

echo ""
echo "✅ Done! All tables truncated."
