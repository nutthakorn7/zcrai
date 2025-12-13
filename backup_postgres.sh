#!/bin/bash

BACKUP_DIR="/root/backups/postgres"
CONTAINER_NAME="zcrai_postgres"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${DATE}.sql.gz"

# Create backup dir
mkdir -p "$BACKUP_DIR"

# Dump and compress
echo "[$(date)] Starting backup..."
if docker exec -t $CONTAINER_NAME pg_dumpall -c -U postgres | gzip > "$BACKUP_DIR/$FILENAME"; then
  echo "[$(date)] Backup success: $FILENAME"
else
  echo "[$(date)] Backup failed!"
  exit 1
fi

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
echo "[$(date)] Cleanup complete."
