# zcrAI Production Server

## SSH Access
```bash
ssh zcrAI
```

## Server Info
| Field | Value |
|-------|-------|
| **Hostname** | zcrai |
| **IP** | 45.118.132.160 |
| **User** | root |
| **OS** | Ubuntu 24.04 |
| **RAM** | 8GB |
| **Disk** | 157GB |

## Deployment Strategy
We use **GitHub Actions** + **Docker Compose** for deployment.
1. Code is pushed to `main`.
2. GitHub Action connects via SSH.
3. Code is synced via `rsync`.
4. Production `.env` is generated from GitHub Secrets.
5. `docker compose -f docker-compose.prod.yml up -d --build` is executed.

## Manual Deployment (Fallback)
If GitHub Actions fails, you can deploy manually:

```bash
# 1. SSH into server
ssh zcrAI

# 2. Navigate to directory
cd /root/zcrAI

# 3. Pull latest code (if git is used on server) OR rsync from local
# (Local)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' -e ssh ./ zcrAI:/root/zcrAI/

# 4. Rebuild and Restart
docker compose -f docker-compose.prod.yml up -d --build --force-recreate backend frontend collector
```

## Troubleshooting
```bash
# View Logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Restart all
docker compose -f docker-compose.prod.yml restart

# Check status
docker compose -f docker-compose.prod.yml ps
```

## Required Environment Variables (GitHub Secrets)
Ensure these are set in Repo Settings > Secrets:
- `SSH_PRIVATE_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `SUPERADMIN_PASSWORD`
- `GEMINI_API_KEY`
- `SSO_ISSUER`
- `SSO_CLIENT_ID`
- `SSO_CLIENT_SECRET`
- `SSO_REDIRECT_URI`
