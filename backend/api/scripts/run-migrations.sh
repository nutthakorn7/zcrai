#!/bin/bash
# scripts/run-migrations.sh
# Run all PostgreSQL migrations automatically

set -e

echo "🔄 Running PostgreSQL migrations..."

# Wait for PostgreSQL to be ready
until docker exec zcrai-postgres pg_isready -U postgres; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run all migration files in order
MIGRATIONS_DIR="./infra/db/migrations"

if [ -d "$MIGRATIONS_DIR" ]; then
  for migration in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration" ]; then
      echo "📄 Running: $(basename $migration)"
      docker exec -i zcrai-postgres psql -U postgres -d zcrai < "$migration" 2>&1 || true
    fi
  done
  echo "✅ All migrations completed!"
else
  echo "⚠️ No migrations directory found at $MIGRATIONS_DIR"
fi
