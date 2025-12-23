#!/bin/bash
# Run ClickHouse migration on production server
# Usage: ./run_clickhouse_migration.sh

set -e

SERVER="root@45.118.132.160"
PASSWORD="#8#J8YMULd6u8iQ"
MIGRATION_FILE="backend/api/infra/clickhouse/migrations/004_dashboard_performance_views.sql"

echo "📦 Uploading migration file to server..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no "$MIGRATION_FILE" "$SERVER:/tmp/clickhouse_migration.sql"

echo "🚀 Running migration on ClickHouse..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "clickhouse-client --user=default --password=clickhouse --database=zcrai --multiquery < /tmp/clickhouse_migration.sql"

echo "✅ Migration completed successfully!"

echo "📊 Verifying materialized views..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "clickhouse-client --user=default --password=clickhouse --database=zcrai -q \"SHOW TABLES LIKE 'mv_%'\""

echo "🎯 Done!"
