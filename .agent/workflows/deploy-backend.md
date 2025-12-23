---
description: Deploy backend to production server (zcrAI) using Docker Compose
---

# Deployment Workflow for zcrAI Backend (Docker)

// turbo-all

## Prerequisites
- SSH access to `zcrAI` server configured
- Backend code in `/Users/pop7/Code/zcrAI/backend`

## Steps

### 1. Sync Code to Server
```bash
rsync -avz --exclude 'node_modules' backend/ zcrAI:/root/zcrAI/backend/
```

### 2. Redeploy with Docker Compose
Rebuilds the backend image and restarts services (updates backend and frontend/nginx).
```bash
ssh zcrAI "cd /root/zcrAI && docker compose -f docker-compose.prod.yml up -d --build backend frontend"
```

### 3. Verify Health (Internal)
Checks if the backend container is responding.
```bash
ssh zcrAI "curl -v http://localhost:8000/health"
```

### 4. Verify Health (External via Nginx)
Checks if Nginx is correctly proxying requests (requires Host header if testing from localhost).
```bash
ssh zcrAI "curl -k -I -H 'Host: app.zcr.ai' https://localhost/health"
```

### 5. Commit Changes
```bash
git add -A && git commit -m "Deploy: [description]" && git push
```

---

## Troubleshooting

### If Nginx is missing (Connection Refused on 443)
Ensure the frontend container is running:
```bash
ssh zcrAI "docker compose -f docker-compose.prod.yml up -d frontend"
```

### If 502 Bad Gateway
1. Check backend logs: `ssh zcrAI "docker logs zcrai_backend --tail 50"`
2. Verify backend is running: `ssh zcrAI "docker ps | grep backend"`
