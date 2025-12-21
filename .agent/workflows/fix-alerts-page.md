---
description: วิธีแก้ปัญหาหน้า Alerts ไม่แสดงข้อมูล (401/500 errors)
---

# Troubleshooting Alerts Page Display Issues

เมื่อหน้า `/alerts` ไม่แสดงข้อมูลหรือเกิด error ให้ตรวจสอบตามลำดับนี้:

## 1. ตรวจสอบ Backend Status
```bash
ssh zcrAI "pm2 status"
ssh zcrAI "pm2 logs zcrAI-backend --lines 50 --nostream" | grep -E "error|Error|401|500"
```

## 2. ตรวจสอบ Account Lockout (ถ้าเจอ 401)

ถ้ามี error `Account locked. Try again in X seconds`:

```bash
# ดู lockout keys
ssh zcrAI "docker exec zcrai_redis redis-cli -a redis_password KEYS '*lockout*'"

# ลบ lockout keys
// turbo
ssh zcrAI "docker exec zcrai_redis redis-cli -a redis_password DEL 'lockout:superadmin@zcr.ai'"
```

## 3. ตรวจสอบ Auth Middleware (ถ้าเจอ 401)

หน้า `/alerts` ใช้ `/api/logs` endpoint ซึ่งอยู่ใน `logs.controller.ts`:

- **ที่ถูกต้อง**: ใช้ `withAuth` จาก `../middleware/auth`
- **ที่ผิด**: ใช้ `tenantAdminOnly` จาก `../middlewares/auth.middleware` (มี s)

```typescript
// ✅ ถูกต้อง - ใช้ withAuth
import { withAuth } from '../middleware/auth'
export const logsController = new Elysia({ prefix: '/logs' })
  .use(withAuth)
```

## 4. ตรวจสอบ ClickHouse Query Errors (ถ้าเจอ 500)

### Error: "Storage MergeTree doesn't support FINAL"
ลบ `FINAL` ออกจาก queries ใน `logs.service.ts`:
```diff
- FROM security_events FINAL
+ FROM security_events
```

### Error: "Unknown expression identifier 'X'"
ตรวจสอบ schema ของ ClickHouse table:
```bash
ssh zcrAI "curl -s 'http://default:clickhouse@localhost:8123/?database=zcrai' --data 'DESCRIBE security_events'"
```

แก้ไข SQL ใน `logs.service.ts` ให้ match กับ columns ที่มีจริง

## 5. Deploy และ Restart Backend

```bash
# Sync file ที่แก้ไข
rsync -avz -e ssh /Users/pop7/Code/zcrAI/backend/api/controllers/logs.controller.ts zcrAI:/root/zcrAI/backend/api/controllers/logs.controller.ts
rsync -avz -e ssh /Users/pop7/Code/zcrAI/backend/api/core/services/logs.service.ts zcrAI:/root/zcrAI/backend/api/core/services/logs.service.ts

# Restart backend
// turbo
ssh zcrAI "pm2 restart zcrAI-backend"
```

## 6. ตรวจสอบว่า Alerts Page ทำงาน

ไฟล์ที่เกี่ยวข้อง:
- **Frontend**: `/frontend/src/pages/alerts/index.tsx` - เรียก `/api/logs`
- **Backend Controller**: `/backend/api/controllers/logs.controller.ts`
- **Backend Service**: `/backend/api/core/services/logs.service.ts`

## Key Files Summary

| ไฟล์ | หน้าที่ |
|------|--------|
| `logs.controller.ts` | Auth middleware + route handlers |
| `logs.service.ts` | ClickHouse queries |
| `middleware/auth.ts` | withAuth (ใช้กับ alerts) |
| `middlewares/auth.middleware.ts` | tenantAdminOnly (ใช้กับ admin routes) |
