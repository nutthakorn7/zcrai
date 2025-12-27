#!/bin/bash
set -e

echo "=== ZcrAI Data Migration Script ==="
echo "This script will migrate your databases to Docker volumes"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root${NC}"
  exit 1
fi

echo -e "${YELLOW}Step 1: Creating backup directory${NC}"
BACKUP_DIR="/tmp/zcrai_migration_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Backup directory: $BACKUP_DIR"

echo -e "${YELLOW}Step 2: Backing up PostgreSQL${NC}"
if command -v pg_dump &> /dev/null; then
  pg_dump -U zcrai -h localhost zcrai > "$BACKUP_DIR/postgres_backup.sql" 2>/dev/null || \
  docker exec zcrai-postgres pg_dump -U zcrai zcrai > "$BACKUP_DIR/postgres_backup.sql" || \
  echo -e "${YELLOW}PostgreSQL backup skipped (not found or already in Docker)${NC}"
else
  echo -e "${YELLOW}PostgreSQL not found, skipping backup${NC}"
fi

echo -e "${YELLOW}Step 3: Backing up ClickHouse${NC}"
if command -v clickhouse-client &> /dev/null; then
  clickhouse-client --query="SHOW TABLES FROM zcrai" > "$BACKUP_DIR/clickhouse_tables.txt" 2>/dev/null || \
  docker exec zcrai-clickhouse clickhouse-client --query="SHOW TABLES FROM zcrai" > "$BACKUP_DIR/clickhouse_tables.txt" || \
  echo -e "${YELLOW}ClickHouse backup skipped${NC}"
else
  echo -e "${YELLOW}ClickHouse not found, skipping backup${NC}"
fi

echo -e "${YELLOW}Step 4: Backing up Redis${NC}"
if command -v redis-cli &> /dev/null; then
  redis-cli --rdb "$BACKUP_DIR/redis_backup.rdb" 2>/dev/null || \
  docker exec zcrai-redis redis-cli --rdb /tmp/dump.rdb && docker cp zcrai-redis:/tmp/dump.rdb "$BACKUP_DIR/redis_backup.rdb" || \
  echo -e "${YELLOW}Redis backup skipped${NC}"
else
  echo -e "${YELLOW}Redis not found, skipping backup${NC}"
fi

echo -e "${GREEN}Backups completed!${NC}"
echo "Backup location: $BACKUP_DIR"
echo ""
echo -e "${YELLOW}Step 5: Stopping old services${NC}"

# Try systemd first
systemctl stop postgresql 2>/dev/null || echo "PostgreSQL systemd service not found"
systemctl stop clickhouse-server 2>/dev/null || echo "ClickHouse systemd service not found"
systemctl stop redis 2>/dev/null || echo "Redis systemd service not found"

# Try Docker
docker stop zcrai-postgres 2>/dev/null || echo "PostgreSQL container not found"
docker stop zcrai-clickhouse 2>/dev/null || echo "ClickHouse container not found"
docker stop zcrai-redis 2>/dev/null || echo "Redis container not found"

echo -e "${GREEN}Old services stopped${NC}"
echo ""
echo -e "${YELLOW}Step 6: Starting new Docker services${NC}"
cd /var/www/zcrai
docker-compose up -d postgres clickhouse redis

echo "Waiting for services to be ready..."
sleep 10

echo -e "${YELLOW}Step 7: Restoring data${NC}"

# Restore PostgreSQL
if [ -f "$BACKUP_DIR/postgres_backup.sql" ]; then
  echo "Restoring PostgreSQL..."
  docker exec -i zcrai-postgres psql -U zcrai -d zcrai < "$BACKUP_DIR/postgres_backup.sql"
  echo -e "${GREEN}PostgreSQL restored${NC}"
fi

# Restore ClickHouse (if needed)
if [ -f "$BACKUP_DIR/clickhouse_tables.txt" ]; then
  echo -e "${YELLOW}ClickHouse tables found, but restore requires manual intervention${NC}"
  echo "Please restore ClickHouse manually if needed"
fi

# Restore Redis (if needed)
if [ -f "$BACKUP_DIR/redis_backup.rdb" ]; then
  echo "Restoring Redis..."
  docker cp "$BACKUP_DIR/redis_backup.rdb" zcrai-redis:/data/dump.rdb
  docker restart zcrai-redis
  echo -e "${GREEN}Redis restored${NC}"
fi

echo ""
echo -e "${GREEN}=== Migration Complete! ===${NC}"
echo "Backups are stored in: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Verify data: docker exec zcrai-postgres psql -U zcrai -d zcrai -c 'SELECT COUNT(*) FROM alerts;'"
echo "2. Test application: curl http://localhost:3000/api/health"
echo "3. If everything works, you can remove backups: rm -rf $BACKUP_DIR"
