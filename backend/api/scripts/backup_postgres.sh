#!/bin/bash
set -e

# Load env variables if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Configuration
BACKUP_DIR=${BACKUP_DIR:-"./backups"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${TIMESTAMP}.sql.gz"
OUTPUT_PATH="${BACKUP_DIR}/${FILENAME}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[Backup] Starting backup procedure..."
echo "[Backup] Target: $OUTPUT_PATH"

# Detect if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "[Backup] Error: pg_dump could not be found"
    exit 1
fi

# Execute Backup
if [ -n "$DATABASE_URL" ]; then
    echo "[Backup] Using DATABASE_URL connection..."
    pg_dump "$DATABASE_URL" --format=plain --no-owner --no-privileges | gzip > "$OUTPUT_PATH"
else
    echo "[Backup] Using default connection (localhost)..."
    pg_dump -h localhost -U postgres -d zcrai --format=plain --no-owner --no-privileges | gzip > "$OUTPUT_PATH"
fi

echo "[Backup] Success! File created ($FILENAME)"
