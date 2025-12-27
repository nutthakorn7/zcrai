# zcrAI Deployment Guide

Production deployment guide for DevOps and SRE teams.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Application Deployment](#application-deployment)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Monitoring & Operations](#monitoring--operations)
6. [Security Hardening](#security-hardening)
7. [Backup & Recovery](#backup--recovery)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum (Small/Dev)**
- 4 vCPU
- 16 GB RAM
- 100 GB SSD
- Ubuntu 22.04 LTS

**Recommended (Production)**
- 8+ vCPU
- 32+ GB RAM
- 500 GB SSD (NVMe recommended)
- Ubuntu 22.04 LTS

### Software Dependencies

- **Node.js** 20+ or **Bun** 1.0+
- **PostgreSQL** 16+
- **ClickHouse** 24+
- **Redis** 7+
- **Nginx** 1.24+
- **Docker** 24+ (optional for containers)
- **Git** 2.40+

---

## Infrastructure Setup

### Option 1: Bare Metal / VM

#### 1. Install PostgreSQL

```bash
# Add repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc

# Install
sudo apt update
sudo apt install -y postgresql-16

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE zcrai;
CREATE USER zcrai_user WITH PASSWORD 'CHANGE_ME';
GRANT ALL PRIVILEGES ON DATABASE zcrai TO zcrai_user;
\c zcrai
GRANT ALL ON SCHEMA public TO zcrai_user;
EOF
```

#### 2. Install ClickHouse

```bash
# Add repository
curl https://clickhouse.com/ | sh
sudo ./clickhouse install

# Start service
sudo systemctl start clickhouse-server
sudo systemctl enable clickhouse-server

# Create database
clickhouse-client --query "CREATE DATABASE zcrai"
```

#### 3. Install Redis

```bash
sudo apt install -y redis-server

# Configure (optional)
sudo nano /etc/redis/redis.conf
# Set: requirepass YOUR_STRONG_PASSWORD

sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

#### 4. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

#### 5. Install Bun (Backend Runtime)

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

#### 6. Install Node.js (Frontend Build)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

### Option 2: Docker Compose

```bash
# Clone repository
git clone https://github.com/nutthakorn7/zcrai.git
cd zcrai

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose ps
```

---

## Application Deployment

### Manual Deployment

#### 1. Clone Repository

```bash
cd /var/www
sudo git clone https://github.com/nutthakorn7/zcrai.git
sudo chown -R $USER:$USER zcrai
cd zcrai
```

#### 2. Configure Environment

**Backend (.env)**
```bash
cd /var/www/zcrai/backend/api
cp .env.example .env
nano .env
```

```env
NODE_ENV=production
PORT=8000

# Database
DATABASE_URL=postgres://zcrai_user:PASSWORD@localhost:5432/zcrai

# ClickHouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DB=zcrai

# Redis
REDIS_URL=redis://:PASSWORD@localhost:6379

# Redis (Cache & Pub/Sub)
REDIS_URL=redis://:PASSWORD@localhost:6379
# Optional: Cache TTLs (in seconds)
CACHE_TTL_USER=300
CACHE_TTL_TENANT=600

# JWT (Generate secure random string)
JWT_SECRET=CHANGE_TO_RANDOM_64_CHAR_STRING
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=CHANGE_TO_32_CHAR_STRING

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourcompany.com
SMTP_PASS=YOUR_APP_PASSWORD
SMTP_FROM=noreply@yourcompany.com

# AI
GOOGLE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Frontend URL
FRONTEND_URL=https://app.zcr.ai

# Super Admin
SUPERADMIN_EMAIL=admin@yourcompany.com
SUPERADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD
```

**Generate Secrets**
```bash
# JWT Secret
openssl rand -base64 48

# Encryption Key
openssl rand -hex 16
```

#### 3. Deploy Backend

```bash
cd /var/www/zcrai/backend/api

# Install dependencies
bun install --production

# Run migrations
bun run db:push

# Build (if needed)
# bun build

# Start with PM2 (process manager)
sudo npm install -g pm2
pm2 start index.ts --name zcrai-backend --interpreter bun
pm2 save
pm2 startup  # Follow instructions
```

#### 4. Deploy Frontend

```bash
cd /var/www/zcrai/frontend

# Install dependencies
npm ci --production

# Build
npm run build

# Copy to Nginx
sudo cp -r dist/* /var/www/html/
```

#### 5. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/zcrai
```

```nginx
server {
    listen 80;
    server_name app.zcr.ai;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.zcr.ai;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/app.zcr.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.zcr.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Swagger
    location /swagger/ {
        proxy_pass http://localhost:8000/swagger/;
        proxy_set_header Host $host;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.openai.com;" always;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/zcrai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Install SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.zcr.ai
sudo systemctl reload nginx
```

---

## CI/CD Pipeline

### GitHub Actions Setup

#### 1. Create Deployment Workflow

`.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [ master ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup SSH
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa

      - name: Add host to known_hosts
        run: |
          ssh-keyscan -H ${{ secrets.SERVER_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy Code via Rsync
        run: |
          rsync -avz --delete \
            --exclude node_modules \
            --exclude .env \
            --exclude dist \
            ./ ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:/var/www/zcrai/

      - name: Restore Production Env
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} "cp /root/zcrai_prod.env /var/www/zcrai/backend/api/.env"

      - name: Install Backend Dependencies
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} "cd /var/www/zcrai/backend/api && bun install --production"

      - name: Build Frontend
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} "cd /var/www/zcrai/frontend && npm ci && npm run build"

      - name: Deploy Frontend to Nginx
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} "sudo cp -r /var/www/zcrai/frontend/dist/* /var/www/html/"

      - name: Restart Backend
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} "pm2 restart zcrai-backend"

      - name: Health Check
        run: |
          sleep 10
          curl -f https://app.zcr.ai/api/health || exit 1
```

#### 2. Configure Secrets

In GitHub repository settings > Secrets and variables > Actions:

- `SSH_PRIVATE_KEY` - Private SSH key for server access
- `SERVER_HOST` - Production server IP/hostname
- `SERVER_USER` - SSH username (e.g., `root`)

---

## Monitoring & Operations

### PM2 Monitoring

```bash
# View logs
pm2 logs zcrai-backend

# Monitoring dashboard
pm2 monit

# Restart
pm2 restart zcrai-backend

# Status
pm2 status
```

### Database Monitoring

**PostgreSQL**
```bash
sudo -u postgres psql -d zcrai -c "SELECT * FROM pg_stat_activity;"
```

**ClickHouse**
```bash
clickhouse-client --query "SELECT * FROM system.processes"
```

### System Resources

```bash
# CPU/RAM
htop

# Disk usage
df -h

# Network
netstat -tuln
```

### Log Files

- **Nginx Access**: `/var/log/nginx/access.log`
- **Nginx Error**: `/var/log/nginx/error.log`
- **Backend**: `pm2 logs zcrai-backend`
- **PostgreSQL**: `/var/log/postgresql/postgresql-16-main.log`
- **ClickHouse**: `/var/log/clickhouse-server/clickhouse-server.log`

---

## Security Hardening

### Firewall (UFW)

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status
```

### Fail2ban (Brute Force Protection)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Database Security

**PostgreSQL**
```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Only allow local connections
# host    all             all             127.0.0.1/32            scram-sha-256
```

**ClickHouse**
```bash
# Edit config.xml
sudo nano /etc/clickhouse-server/config.xml

# Uncomment:
<listen_host>127.0.0.1</listen_host>
```

### Application Security

1. **Change default passwords**
2. **Enable MFA** for all admins
3. **Use strong JWT secrets**
4. **Rotate API keys** quarterly
5. **Limit CORS origins** in production

---

## Backup & Recovery

### Automated Backups

#### PostgreSQL Backup Script

`/root/backup_postgres.sh`

```bash
#!/bin/bash

BACKUP_DIR="/root/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

cd /var/www/zcrai
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup success: $FILENAME"
else
  echo "[$(date)] Backup failed!"
  exit 1
fi

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /root/backup_postgres.sh
```

#### Schedule with Cron

```bash
crontab -e

# Add daily backup at 2 AM
0 2 * * * /root/backup_postgres.sh >> /var/log/backups.log 2>&1
```

### Restore from Backup

```bash
# Stop backend
pm2 stop zcrai-backend

# Restore database
gunzip < /root/backups/postgres/backup_YYYYMMDD_HHMMSS.sql.gz | psql $DATABASE_URL

# Restart backend
pm2 start zcrai-backend
```

### Manual Backup (UI)
Administrators can now trigger backups directly from the **Settings > System Management** dashboard.
- Files are saved to `/backend/api/backups` by default.
- Downloadable directly via the browser.

---

## Troubleshooting

### Backend Won't Start

```bash
# Check PM2 logs
pm2 logs zcrai-backend --lines 100

# Common issues:
# - Database connection failed: Check DATABASE_URL in .env
# - Port already in use: Kill process on port 8000
# - Missing dependencies: Run `bun install`
```

### Frontend 404 Errors

```bash
# Rebuild frontend
cd /var/www/zcrai/frontend
npm run build
sudo cp -r dist/* /var/www/html/

# Check Nginx config
sudo nginx -t
sudo systemctl reload nginx
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check if accepting connections
sudo -u postgres psql -c "SELECT 1"

# Verify credentials
psql $DATABASE_URL -c "SELECT 1"
```

### High Memory Usage

```bash
# Check PM2 processes
pm2 status

# Restart if needed
pm2 restart zcrai-backend

# Optimize ClickHouse
clickhouse-client --query "OPTIMIZE TABLE security_events"
```

---

## Performance Tuning

### PostgreSQL

`/etc/postgresql/16/main/postgresql.conf`

```ini
# For 32GB RAM server
shared_buffers = 8GB
effective_cache_size = 24GB
maintenance_work_mem = 2GB
work_mem = 64MB
```

### ClickHouse

`/etc/clickhouse-server/config.xml`

```xml
<max_memory_usage>20000000000</max_memory_usage>
<max_concurrent_queries>100</max_concurrent_queries>
```

### Nginx

`/etc/nginx/nginx.conf`

```nginx
worker_processes auto;
worker_connections 4096;

gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;
```

---

## Scaling

### Horizontal Scaling

For high-traffic deployments:

1. **Load Balancer** (Nginx/HAProxy)
2. **Multiple Backend Instances** (PM2 cluster mode)
3. **Database Read Replicas** (PostgreSQL streaming replication)
4. **ClickHouse Cluster** (Distributed tables)
5. **Redis Cluster** (For session sharing)

### Vertical Scaling

- **Upgrade server specs** (More RAM/CPU)
- **Use SSD/NVMe** for databases
- **Increase connection pools**

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor logs for errors
- Check disk space
- Review security alerts

**Weekly:**
- Review backup integrity
- Update dependencies (staging first)
- Analyze slow queries

**Monthly:**
- Rotate SSL certificates (auto with Let's Encrypt)
- Review access logs
- Optimize database tables

---

## Support & Resources

- **Documentation**: [docs.zcr.ai](https://docs.zcr.ai)
- **Issues**: [github.com/nutthakorn7/zcrai/issues](https://github.com/nutthakorn7/zcrai/issues)
- **Email**: devops@zcr.ai

---

**Good Luck with Your Deployment! 🚀**
