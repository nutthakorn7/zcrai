---
description: วิธีแก้ปัญหา Enrichment Integration 400 Error (AlienVault/VirusTotal/AbuseIPDB)
---

# Troubleshooting Enrichment Integration Errors

เมื่อพบ `400 Bad Request` หรือ integration ไม่แสดงใน UI ให้ทำตามขั้นตอนนี้:

## 1. ตรวจสอบ ENCRYPTION_KEY

```bash
# Check current key in PM2
ssh root@45.118.132.160 "cat /root/zcrAI/backend/api/ecosystem.config.cjs | grep ENCRYPTION"

# Key ต้องเป็น 32 ตัวอักษร - ถ้าเป็น placeholder ให้แก้:
ssh root@45.118.132.160 "cat > /root/zcrAI/backend/api/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: \"zcrAI-backend\",
    script: \"/usr/bin/bun\",
    args: [\"run\", \"index.ts\"],
    cwd: \"/root/zcrAI/backend/api\",
    exec_mode: \"fork\",
    exec_interpreter: \"none\",
    env: {
      NODE_ENV: \"production\",
      ENCRYPTION_KEY: \"zcrAI_32char_encryption_key_2024\",
      REDIS_URL: \"redis://:redis_password@localhost:6379\",
      DATABASE_URL: \"postgres://postgres:postgres@localhost:5432/zcrai\",
      JWT_SECRET: \"zcrAI_super_secure_jwt_secret_2024_production_key\"
    }
  }]
}
EOF"

# Restart PM2
ssh root@45.118.132.160 "cd /root/zcrAI/backend/api && pm2 delete zcrAI-backend; pm2 start ecosystem.config.cjs && pm2 save"
```

## 2. ตรวจสอบ Database Port

```bash
# ต้องเป็น port 5432 (ไม่ใช่ 5433)
ssh root@45.118.132.160 "docker ps | grep postgres"  # ดู port ที่ใช้

# แก้ .env ถ้าผิด
ssh root@45.118.132.160 "sed -i 's/localhost:5433/localhost:5432/g' /root/zcrAI/backend/api/.env"
```

## 3. Test Backend API โดยตรง

```bash
ssh root@45.118.132.160 '
# Login
curl -s -c /tmp/cookies.txt -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"superadmin@zcr.ai\", \"password\": \"SuperAdmin@123!\"}"

# List integrations
curl -s -b /tmp/cookies.txt "http://localhost:8000/integrations"

# Add enrichment (เปลี่ยน provider และ apiKey ตามต้องการ)
curl -s -b /tmp/cookies.txt -X POST "http://localhost:8000/integrations/enrichment/alienvault" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"YOUR_API_KEY\", \"label\": \"AlienVault OTX\"}"
'
```

## 4. Deploy Frontend ไปที่ถูก Directory

```bash
# Frontend dist ต้อง sync ไปที่ /var/www/zcrai (ไม่ใช่ /root/zcrAI/frontend/dist)
rsync -avz --delete /Users/pop7/Code/zcrAI/frontend/dist/ root@45.118.132.160:/root/zcrAI/frontend/dist/

# IMPORTANT: Sync ไปที่ nginx mount path ด้วย!
ssh root@45.118.132.160 "rsync -avz --delete /root/zcrAI/frontend/dist/ /var/www/zcrai/"

# Reload nginx
ssh root@45.118.132.160 "docker exec zcrai-nginx nginx -s reload"
```

## 5. Clear Browser Cache

หลัง deploy ถ้า UI ยังไม่เปลี่ยน:
- กด `Cmd + Shift + R` (Mac) หรือ `Ctrl + Shift + R` (Windows)
- หรือเปิด Incognito mode

## 6. ลบ Duplicate Records (ถ้ามี)

```bash
ssh root@45.118.132.160 "docker exec zcrai_postgres psql -U postgres -d zcrai -c \"SELECT id, provider, label FROM api_keys;\""

# ลบ duplicates (เก็บ ID ที่ต้องการไว้)
ssh root@45.118.132.160 "docker exec zcrai_postgres psql -U postgres -d zcrai -c \"DELETE FROM api_keys WHERE provider = 'alienvault-otx' AND id != 'KEEP_THIS_ID';\""
```

## 7. Fix Collector 401 Authentication Error

หาก Collector ได้รับ 401 Unauthorized เมื่อ sync:

```bash
# Check collector logs for 401 error
ssh root@45.118.132.160 "docker logs zcrai_collector --tail 20 2>&1 | grep -E '401|Failed'"

# Check if COLLECTOR_API_KEY matches
ssh root@45.118.132.160 "docker exec zcrai_collector env | grep COLLECTOR_API_KEY"

# Add matching key to backend ecosystem.config.cjs
ssh root@45.118.132.160 "cat /root/zcrAI/backend/api/ecosystem.config.cjs | grep COLLECTOR"

# If missing, update ecosystem.config.cjs:
ssh root@45.118.132.160 "cat > /root/zcrAI/backend/api/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: \"zcrAI-backend\",
    script: \"/usr/bin/bun\",
    args: [\"run\", \"index.ts\"],
    cwd: \"/root/zcrAI/backend/api\",
    exec_mode: \"fork\",
    exec_interpreter: \"none\",
    env: {
      NODE_ENV: \"production\",
      ENCRYPTION_KEY: \"zcrAI_32char_encryption_key_2024\",
      REDIS_URL: \"redis://:redis_password@localhost:6379\",
      DATABASE_URL: \"postgres://postgres:postgres@localhost:5432/zcrai\",
      JWT_SECRET: \"zcrAI_super_secure_jwt_secret_2024_production_key\",
      COLLECTOR_API_KEY: \"zcrAI_super_secure_collector_key_2024\",
      COLLECTOR_URL: \"http://localhost:8001\"
    }
  }]
}
EOF"

# Restart PM2
ssh root@45.118.132.160 "cd /root/zcrAI/backend/api && pm2 delete zcrAI-backend; pm2 start ecosystem.config.cjs && pm2 save"

# Test sync
ssh root@45.118.132.160 "curl -s -X POST 'http://localhost:8001/collect/all'"
```

## Key Points to Remember

| Component | ค่าที่ถูกต้อง |
|-----------|-------------|
| ENCRYPTION_KEY | 32 characters: `zcrAI_32char_encryption_key_2024` |
| DATABASE_URL | Port **5432**: `postgres://postgres:postgres@localhost:5432/zcrai` |
| COLLECTOR_API_KEY | `zcrAI_super_secure_collector_key_2024` |
| Backend Port | **8000** (ไม่ใช่ 5000) |
| Nginx Mount | `/var/www/zcrai` |
| AlienVault Provider | Backend: `alienvault-otx`, Frontend: `alienvault` |
| Auto-Sync Interval | ทุก 15 นาที (cron: `*/15 * * * *`) |

