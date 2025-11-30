#!/bin/bash
# =============================================================================
# Full Reset Script - ล้างทั้ง ClickHouse และ Collector State
# ใช้เมื่อต้องการ test ใหม่ตั้งแต่ต้น
# =============================================================================

CONTAINER="zcrai-clickhouse"
DATABASE="zcrai"

echo "⚠️  FULL RESET - This will delete ALL data!"
echo ""
read -p "Are you sure? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🗑️  Step 1: Truncating ClickHouse tables..."
docker exec $CONTAINER clickhouse-client --query "TRUNCATE TABLE $DATABASE.security_events"
docker exec $CONTAINER clickhouse-client --query "TRUNCATE TABLE $DATABASE.security_events_daily_mv" 2>/dev/null
docker exec $CONTAINER clickhouse-client --query "TRUNCATE TABLE $DATABASE.security_events_top_hosts_mv" 2>/dev/null
docker exec $CONTAINER clickhouse-client --query "TRUNCATE TABLE $DATABASE.security_events_mitre_mv" 2>/dev/null

echo "🔄 Step 2: Resetting collector state..."
# Reset state in collector/cmd/data/
echo '{}' > ./data/state.json 2>/dev/null
echo '{}' > ../cmd/data/state.json 2>/dev/null

echo ""
echo "📊 Verification:"
docker exec $CONTAINER clickhouse-client --query "SELECT count() FROM $DATABASE.security_events"

echo ""
echo "✅ Full reset complete!"
echo ""
echo "Next steps:"
echo "  1. Run collector: go run main.go"
echo "  2. Add Integration from UI"
echo "  3. Wait for sync to complete"
