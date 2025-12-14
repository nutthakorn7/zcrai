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

## SSH Config (~/.ssh/config)
```
Host zcrAI
  HostName 45.118.132.160
  User root
  IdentityFile ~/.ssh/id_rsa
  IdentitiesOnly yes
```

## Deployment Path
- **Backend**: `/root/zcrAI/backend/api`
- **Frontend**: `/root/zcrAI/frontend`

## Ports
- Backend API: 8000
- Frontend: 3000 (or nginx on 80/443)

## Commands
```bash
# SSH into server
ssh zcrAI

# Restart backend
ssh zcrAI "cd /root/zcrAI/backend/api && pm2 restart zcrAI-backend"

# Restart frontend
ssh zcrAI "cd /root/zcrAI/frontend && pm2 restart zcrAI-frontend"

# Deploy latest
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' -e ssh /Users/pop7/Code/zcrAI/ zcrAI:/root/zcrAI/
```
