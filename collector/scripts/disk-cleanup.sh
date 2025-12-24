#!/bin/bash
# ClickHouse Disk Cleanup Script
# Deletes oldest partition when disk > 80%

THRESHOLD=80
DISK_USAGE=$(df -h /var/lib/docker | tail -1 | awk '{print $5}' | tr -d '%')

echo "[$(date)] Disk usage: ${DISK_USAGE}%"

if [ "$DISK_USAGE" -gt "$THRESHOLD" ]; then
  echo "[$(date)] Disk usage exceeds ${THRESHOLD}%, cleaning oldest partition..."
  
  # Get oldest partition
  OLDEST_PARTITION=$(docker exec zcrai_clickhouse clickhouse-client --query "SELECT partition FROM system.parts WHERE database='zcrai' AND table='security_events' ORDER BY partition ASC LIMIT 1")
  
  if [ -n "$OLDEST_PARTITION" ]; then
    echo "[$(date)] Dropping partition: $OLDEST_PARTITION"
    docker exec zcrai_clickhouse clickhouse-client --query "ALTER TABLE zcrai.security_events DROP PARTITION '$OLDEST_PARTITION'"
    echo "[$(date)] Partition $OLDEST_PARTITION dropped successfully"
  else
    echo "[$(date)] No partitions found to drop"
  fi
else
  echo "[$(date)] Disk usage OK, no cleanup needed"
fi
