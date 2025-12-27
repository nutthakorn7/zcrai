# Environment Variables Setup

## Critical: Secure Your .env File

```bash
# Set proper permissions (owner read/write only)
chmod 600 .env

# Verify
ls -la .env
# Should show: -rw------- (600)
```

## Required Environment Variables

### Database
```bash
POSTGRES_USER=zcrai
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=zcrai
```

### Redis
```bash
REDIS_PASSWORD=<strong-password>
```

### ClickHouse
```bash
CLICKHOUSE_PASSWORD=<strong-password>
```

### Encryption (CRITICAL!)
```bash
# Generate with: openssl rand -hex 16
ENCRYPTION_KEY=<32-character-hex-string>
```

**⚠️ WARNING:** If you lose this key, all encrypted integration API keys will be unrecoverable!

### JWT
```bash
JWT_SECRET=<strong-secret>
```

## Backup Strategy

### 1. Backup .env File
```bash
# Encrypt and backup
gpg -c .env
# Creates .env.gpg (encrypted backup)
```

### 2. Store Securely
- ✅ Password manager (1Password, LastPass)
- ✅ Encrypted USB drive
- ✅ Secure cloud storage (encrypted)
- ❌ Never commit to git
- ❌ Never share via email/Slack

### 3. Disaster Recovery
```bash
# Restore from backup
gpg -d .env.gpg > .env
chmod 600 .env
docker-compose restart
```

## Best Practices

1. **Different keys per environment**
   - Dev: `ENCRYPTION_KEY_DEV`
   - Staging: `ENCRYPTION_KEY_STAGING`
   - Prod: `ENCRYPTION_KEY_PROD`

2. **Rotate keys every 90 days**
   ```bash
   # Generate new key
   openssl rand -hex 16
   
   # Re-encrypt all integrations with new key
   # (requires migration script)
   ```

3. **Audit access**
   ```bash
   # Check who accessed .env
   sudo ausearch -f /root/zcrAI/.env
   ```

## Current Setup (zcrAI)

✅ **Stable & Secure:**
- `.env` file with 600 permissions
- ENCRYPTION_KEY stored securely
- PostgreSQL persistent volume
- Automatic backups via Docker volumes

**This is production-ready and won't lose data!** 🎯
