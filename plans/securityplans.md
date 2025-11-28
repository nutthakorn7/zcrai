# zcrAI - Security Plan

## Overview
Security-first approach สำหรับ SOC Dashboard ที่จัดการข้อมูล Security Logs ที่มีความสำคัญสูง

---

## 1. Authentication & Session Management

### 1.1 Authentication Flow
```
┌─────────────────────────────────────────────────────────────┐
│                     Login Flow                               │
├─────────────────────────────────────────────────────────────┤
│  1. User submit credentials (email + password)              │
│  2. Backend verify password (Argon2id hash)                 │
│  3. If MFA enabled → verify TOTP code                       │
│  4. Generate access_token + refresh_token                   │
│  5. Set HttpOnly Cookies → return user profile              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Session Cookies (NOT LocalStorage)
| Cookie | Purpose | Settings |
|--------|---------|----------|
| `access_token` | Short-lived auth | HttpOnly, Secure, SameSite=Strict, Max-Age=15min |
| `refresh_token` | Token renewal | HttpOnly, Secure, SameSite=Strict, Path=/api/auth/refresh, Max-Age=7d |

**Why Cookies over LocalStorage?**
- HttpOnly → JavaScript cannot read (XSS protection)
- Secure → HTTPS only
- SameSite=Strict → CSRF protection

### 1.3 Token Strategy
```
Access Token (JWT):
├── Payload: user_id, tenant_id, role, permissions
├── Expiry: 15 minutes
├── Signing: RS256 (asymmetric)
└── Storage: HttpOnly Cookie

Refresh Token:
├── Format: Opaque random string (not JWT)
├── Expiry: 7 days
├── Storage: HttpOnly Cookie + Redis (server-side validation)
└── Rotation: New refresh token on each use (detect reuse = revoke all)
```

### 1.4 Password Policy
| Rule | Requirement |
|------|-------------|
| Minimum Length | 12 characters |
| Complexity | Upper + Lower + Number + Special |
| Hash Algorithm | Argon2id (memory-hard) |
| Breach Check | HaveIBeenPwned API (on registration/change) |
| History | Cannot reuse last 5 passwords |

### 1.5 Multi-Factor Authentication (MFA)
- **TOTP** (Google Authenticator, Authy)
- **Required for**: Super Admin, Tenant Admin
- **Optional for**: SOC Analyst, Customer
- **Backup Codes**: 10 one-time codes (hashed, stored in DB)

---

## 2. Authorization (RBAC)

### 2.1 Permission Enforcement
```
Every API Request:
├── 1. Validate access_token (signature + expiry)
├── 2. Extract user_id, tenant_id, role
├── 3. Check permission against route
├── 4. Verify tenant_id matches requested resource
└── 5. Allow or Deny (403 Forbidden)
```

### 2.2 Tenant Isolation
- **Row-Level Security (RLS)** in PostgreSQL
- **Every query** includes `WHERE tenant_id = ?`
- **Middleware** automatically injects tenant_id from JWT
- **No cross-tenant access** except Super Admin

### 2.3 API Key Security (for S1/CrowdStrike)
| Aspect | Implementation |
|--------|----------------|
| Storage | AES-256-GCM encrypted in PostgreSQL |
| Encryption Key | Environment variable (not in DB) |
| Display | Masked in UI (show last 4 chars only) |
| Rotation | User can regenerate anytime |
| Scope | Tied to specific tenant only |

---

## 3. API Security

### 3.1 Rate Limiting
| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Login | 5 attempts | 15 minutes |
| API (authenticated) | 100 requests | 1 minute |
| AI Analysis | 10 requests | 1 minute |
| Export Report | 5 requests | 5 minutes |

**Implementation**: Redis sliding window counter

### 3.2 Input Validation
- **Schema Validation**: Zod (TypeScript) for all request bodies
- **SQL Injection**: Parameterized queries only (Drizzle ORM)
- **XSS Prevention**: Output encoding, CSP headers
- **Path Traversal**: Whitelist allowed paths

### 3.3 Security Headers
```typescript
// Elysia middleware
{
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}
```

### 3.4 CORS Policy
```typescript
{
  origin: ['https://app.zcrai.com'],  // Whitelist only
  credentials: true,                    // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}
```

### 3.5 CSRF Protection
- **Double Submit Cookie** pattern
- **X-CSRF-Token** header required for state-changing requests
- **SameSite=Strict** cookie as additional layer

---

## 4. Data Security

### 4.1 Encryption
| Data State | Method |
|------------|--------|
| In Transit | TLS 1.3 (HTTPS) |
| At Rest (DB) | AES-256-GCM for sensitive fields |
| At Rest (Disk) | Full disk encryption (infrastructure) |
| Backups | Encrypted with separate key |

### 4.2 Sensitive Data Handling
| Data Type | Protection |
|-----------|------------|
| Passwords | Argon2id hash (never stored plain) |
| API Keys | AES-256-GCM encrypted |
| PII (email, name) | Encrypted at rest |
| Refresh Tokens | SHA-256 hash in DB |
| Session Data | Redis with encryption |

### 4.3 Data Retention
| Data Type | Retention | Action |
|-----------|-----------|--------|
| Security Logs (ClickHouse) | 90 days default (configurable per tenant) | Auto-delete |
| Audit Logs | 1 year | Archive then delete |
| Closed Cases | 2 years | Archive then delete |
| User Sessions | 7 days inactive | Auto-expire |

---

## 5. Audit Logging

### 5.1 What to Log
| Category | Events |
|----------|--------|
| Authentication | Login success/fail, logout, password change, MFA events |
| Authorization | Permission denied, role changes |
| Data Access | View logs, export reports, AI analysis requests |
| Admin Actions | User CRUD, config changes, API key rotation |
| Case Management | State changes, assignments, comments |

### 5.2 Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "event_type": "auth.login.success",
  "user_id": "uuid",
  "tenant_id": "uuid",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "resource": "/api/auth/login",
  "method": "POST",
  "status_code": 200,
  "details": {}
}
```

### 5.3 Log Security
- **Immutable**: Write-only to ClickHouse
- **No PII in logs**: Mask sensitive data
- **Tamper-evident**: Hash chain (optional)
- **Access Control**: Only Super Admin can view audit logs

---

## 6. Infrastructure Security

### 6.1 Container Security (Docker)
- **Non-root user** in containers
- **Minimal base images** (distroless/alpine)
- **No secrets in images** (use env vars/secrets manager)
- **Read-only filesystem** where possible
- **Resource limits** (CPU, memory)

### 6.2 Network Security
```
┌─────────────────────────────────────────────────────┐
│                    Network Zones                     │
├─────────────────────────────────────────────────────┤
│  [Internet] ←→ [Load Balancer/WAF]                  │
│                      ↓                               │
│              [Frontend (React)]                      │
│                      ↓                               │
│              [API Gateway (Elysia)]                  │
│                      ↓                               │
│         ┌───────────┴───────────┐                   │
│    [PostgreSQL]           [ClickHouse]              │
│    [Redis]                [Vector]                  │
│         └───────────────────────┘                   │
│              (Internal Network Only)                │
└─────────────────────────────────────────────────────┘
```

### 6.3 Secrets Management
| Environment | Method |
|-------------|--------|
| Development | .env files (gitignored) |
| Production | Environment variables / Docker secrets |
| Future | HashiCorp Vault / AWS Secrets Manager |

### 6.4 Dependency Security
- **Automated scanning**: Dependabot / Snyk
- **Lock files**: package-lock.json, go.sum
- **Regular updates**: Weekly dependency review
- **No vulnerable packages**: CI/CD gate

---

## 7. Incident Response

### 7.1 Security Events Monitoring
| Event | Action |
|-------|--------|
| 5+ failed logins | Temporary account lock (15 min) |
| Login from new location | Email notification to user |
| Refresh token reuse detected | Revoke all sessions |
| Admin action on other tenant | Alert Super Admin |
| Unusual data export | Alert + rate limit |

### 7.2 Account Lockout Policy
- **Threshold**: 5 failed attempts
- **Lockout Duration**: 15 minutes (progressive: 15 → 30 → 60 min)
- **Reset**: Successful login or admin unlock
- **Notification**: Email on lockout

### 7.3 Session Revocation
- User can view active sessions
- User can revoke individual sessions
- Admin can force logout all users (tenant-wide)
- Refresh token rotation detects compromise

---

## 8. Compliance Considerations

### 8.1 Data Privacy
- **Consent**: Clear terms of service
- **Data Access**: Users can request their data
- **Data Deletion**: Right to be forgotten (soft delete → hard delete)
- **Data Portability**: Export in standard format

### 8.2 Security Standards Reference
- OWASP Top 10 (Web Application Security)
- NIST Cybersecurity Framework
- CIS Controls

---

## 9. Security Checklist (Development)

### Before Deploy
- [ ] All secrets in environment variables
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF protection enabled
- [ ] Audit logging enabled
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies scanned for vulnerabilities

### Regular Review
- [ ] Dependency updates (weekly)
- [ ] Access review (monthly)
- [ ] Penetration testing (quarterly)
- [ ] Security training (annually)
