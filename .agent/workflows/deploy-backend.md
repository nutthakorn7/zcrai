---
description: Deploy backend to production server (zcrAI)
---

# Deployment Workflow for zcrAI Backend

// turbo-all

## Prerequisites
- SSH access to `zcrAI` server configured
- Backend code in `/Users/pop7/Code/zcrAI/backend`

## Steps

### 1. Sync Code to Server
```bash
rsync -avz --exclude 'node_modules' backend/ zcrAI:/root/zcrAI/backend/
```

### 2. Install Dependencies (if package.json changed)
```bash
ssh zcrAI "cd /root/zcrAI/backend/api && bun install"
```

### 3. Verify .env Configuration
```bash
ssh zcrAI "cat /root/zcrAI/backend/api/.env | grep -E '(GEMINI|VIRUSTOTAL|ABUSEIPDB|OTX)'"
```

Expected output should show API keys configured.

### 4. Restart Backend with start.sh
```bash
ssh zcrAI "pm2 delete zcrAI-backend 2>/dev/null; pm2 start /root/zcrAI/backend/start.sh --name zcrAI-backend && pm2 save"
```

> **IMPORTANT**: Always use `start.sh` (not ecosystem.config.cjs) to ensure `.env` is sourced before Bun starts.

### 5. Verify Backend Health
```bash
sleep 3 && curl -s https://app.zcr.ai/health
```

Expected: `{"status":"ok","timestamp":"..."}`

### 6. Check Logs for Errors
```bash
ssh zcrAI "pm2 logs zcrAI-backend --lines 30 --nostream" | grep -iE "(error:|warning:|✅|🦊)"
```

Should NOT see:
- ❌ "GeminiProvider initialized without API Key"
- ❌ "Cannot find module"
- ❌ "require() async module is unsupported"

### 7. Commit Changes
```bash
git add -A && git commit -m "Deploy: [description]" && git push
```

---

## Troubleshooting

### If "GEMINI_API_KEY is not set"
1. Check `.env` file: `ssh zcrAI "cat /root/zcrAI/backend/api/.env | grep GEMINI"`
2. Verify `start.sh` exists: `ssh zcrAI "cat /root/zcrAI/backend/start.sh"`
3. Restart with start.sh: `ssh zcrAI "pm2 delete zcrAI-backend && pm2 start /root/zcrAI/backend/start.sh --name zcrAI-backend"`

### If "Cannot find module"
```bash
ssh zcrAI "cd /root/zcrAI/backend/api && bun install && pm2 restart zcrAI-backend"
```

### If 502 Bad Gateway
1. Check PM2 status: `ssh zcrAI "pm2 status"`
2. Check error logs: `ssh zcrAI "pm2 logs zcrAI-backend --err --lines 50"`
3. Restart: `ssh zcrAI "pm2 restart zcrAI-backend"`
