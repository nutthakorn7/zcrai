---
description: Troubleshooting Log Ingestion (CrowdStrike/SentinelOne -> Vector -> ClickHouse)
---

# Troubleshooting Log Ingestion

หากหน้า Detections ไม่แสดงข้อมูลใหม่ หรือ Last Sync Stale ให้ตรวจสอบตาม Flow นี้:

## 1. Check Backend Integration Sync Status
ดูว่า sync ล่าสุดสำเร็จหรือไม่:

```sql
docker exec zcrai_postgres psql -U postgres -d zcrai -c "SELECT provider, last_sync_at, last_sync_status FROM api_keys;"
```

## 2. Check Collector Logs
ดูว่า Collector ดึงข้อมูลมาจริงหรือไม่ (หาคำว่า "Fetched" หรือ "Published"):

```bash
docker logs zcrai_collector --tail 50 2>&1 | grep -E "Fetched|Published|Error"
```

Error ที่พบบ่อย:
- `401 Unauthorized`: API Key ไม่ตรง (แก้ใน ecosystem.config.cjs)
- `Published 0 events`: ไม่มีข้อมูลใหม่จาก Source

## 3. Check Vector Logs
Vector รับข้อมูลจาก Collector แล้วส่งเข้า ClickHouse:

```bash
docker logs zcrai_vector --tail 20 2>&1
```

## 4. Check ClickHouse Data
ตรวจสอบว่าข้อมูลเข้า Database จริงหรือไม่:

```bash
# ดูจำนวน Logs ของวันนี้ แยกตาม Source
docker exec zcrai_clickhouse clickhouse-client --password clickhouse --database zcrai --query "SELECT source, count(*), max(timestamp) FROM security_events WHERE timestamp >= today() GROUP BY source"
```

## Schema Reference `security_events`
- `source`: crowdstrike, sentinelone
- `event_type`: process_create, network_connection, etc.
- `severity`: critical, high, medium, low
- `timestamp`: เวลาที่เกิด Event

## Force Trigger Sync
ถ้าต้องการ sync ทันที:
```bash
curl -X POST http://localhost:8001/collect/all
```
