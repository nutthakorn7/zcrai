#!/bin/sh
# ClickHouse Migration Runner
# รัน migrations ที่ยังไม่ได้รัน โดยเช็คจาก migrations table

set -e

CLICKHOUSE_HOST=${CLICKHOUSE_HOST:-clickhouse}
CLICKHOUSE_PORT=${CLICKHOUSE_PORT:-9000}
CLICKHOUSE_USER=${CLICKHOUSE_USER:-default}
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD:-clickhouse}
MIGRATIONS_DIR="/migrations"

echo "🚀 Starting ClickHouse Migration Runner..."
echo "   Host: $CLICKHOUSE_HOST:$CLICKHOUSE_PORT"

# Wait for ClickHouse to be ready
echo "⏳ Waiting for ClickHouse to be ready..."
until clickhouse-client --host "$CLICKHOUSE_HOST" --port "$CLICKHOUSE_PORT" --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" --query "SELECT 1" > /dev/null 2>&1; do
  echo "   ...waiting for ClickHouse..."
  sleep 2
done
echo "✅ ClickHouse is ready!"

# Function to run SQL using clickhouse-client
run_sql() {
  clickhouse-client --host "$CLICKHOUSE_HOST" --port "$CLICKHOUSE_PORT" \
    --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" \
    --query "$1"
}

# Function to run SQL file using clickhouse-client with multiquery
run_sql_file() {
  clickhouse-client --host "$CLICKHOUSE_HOST" --port "$CLICKHOUSE_PORT" \
    --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" \
    --multiquery < "$1"
}

# Create migrations tracking table if not exists
echo "📋 Ensuring migrations table exists..."
run_sql "CREATE TABLE IF NOT EXISTS zcrai.schema_migrations (version String, applied_at DateTime DEFAULT now()) ENGINE = MergeTree() ORDER BY version"

# Get list of applied migrations
echo "📝 Checking applied migrations..."
APPLIED=$(run_sql "SELECT version FROM zcrai.schema_migrations FORMAT TabSeparated")

# Run pending migrations
echo "🔄 Running pending migrations..."
# Use find instead of ls for better portability
for migration_file in $(find "$MIGRATIONS_DIR" -name "*.sql" | sort); do
  filename=$(basename "$migration_file")
  version="${filename%.*}"  # Remove .sql extension
  
  # Check if version exists in APPLIED string
  if echo "$APPLIED" | grep -q "^$version$"; then
    echo "   ⏭️  Skipping $filename (already applied)"
  else
    echo "   🔧 Applying $filename..."
    if run_sql_file "$migration_file"; then
      # Record migration as applied
      run_sql "INSERT INTO zcrai.schema_migrations (version) VALUES ('$version')"
      echo "   ✅ Applied $filename"
    else
      echo "   ❌ Failed to apply $filename"
      exit 1
    fi
  fi
done

echo "🎉 All migrations completed!"
