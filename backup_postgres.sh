#!/bin/bash

# Configuration
# Default to internal container path if not set
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${DATE}.sql.gz"

# Database Connection (from Env)
# Ensure these variables are set in the backend container environment
: "${DATABASE_URL:?Need to set DATABASE_URL}"

# Create backup dir
mkdir -p "$BACKUP_DIR"

# Dump and compress using pg_dump via network
echo "[$(date)] Starting backup to $BACKUP_DIR/$FILENAME..."

# Extract host/port/user/pass/db from DATABASE_URL or expect them to be set
# Simple approach: use pg_dump with the URL directly
if pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$FILENAME"; then
  echo "[$(date)] Backup success: $FILENAME"
  # Set permissions so node process can read it (if needed)
  chmod 644 "$BACKUP_DIR/$FILENAME"
else
  echo "[$(date)] Backup failed!"
  # Clean up empty file if failed
  rm -f "$BACKUP_DIR/$FILENAME"
  exit 1
fi

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
echo "[$(date)] Cleanup complete."
