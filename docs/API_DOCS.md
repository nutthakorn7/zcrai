# zcrAI API Documentation

Complete API reference for developers integrating with the zcrAI platform.

**Base URL:** `https://app.zcr.ai/api`  
**Swagger UI:** `https://app.zcr.ai/swagger`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Patterns](#common-patterns)
3. [API Endpoints](#api-endpoints)
   - [Auth](#auth)
   - [Cases](#cases)
   - [Alerts](#alerts)
   - [Logs](#logs)
   - [Playbooks](#playbooks)
   - [AI](#ai)
   - [System](#system)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Webhooks](#webhooks)

---

## Authentication

### JWT Bearer Token

All API requests (except `/auth/login` and `/auth/register`) require a valid JWT token.

**Flow:**
1. Obtain token via `/auth/login`
2. Include in `Authorization` header
3. Refresh token via `/auth/refresh` before expiry

**Example:**
```bash
curl -X GET https://app.zcr.ai/api/cases \
  -H "Authorization: Bearer eyJhbGc..."
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "analyst@company.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "usr_123",
    "email": "analyst@company.com",
    "role": "analyst"
  }
}
```

**Cookies Set:**
- `access_token` (HttpOnly, 15min TTL)
- `refresh_token` (HttpOnly, 7d TTL)

### Refresh Token

```http
POST /auth/refresh
Cookie: refresh_token=...
```

**Response:**
```json
{
  "message": "Token refreshed"
}
```

### Logout

```http
POST /auth/logout
```

---

## Common Patterns

### Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Example:**
```http
GET /cases?page=2&limit=50
```

**Response:**
```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 50,
    "total": 342,
    "totalPages": 7
  }
}
```

### Filtering

**Query Parameters:**
- `search` - Full-text search
- `status` - Filter by status
- `severity` - Filter by severity
- `assignee` - Filter by user ID

**Example:**
```http
GET /alerts?severity=critical&status=open
```

### Sorting

**Query Parameter:**
- `sort` - Field to sort by (prefix with `-` for descending)

**Example:**
```http
GET /cases?sort=-createdAt
```

---

## API Endpoints

### Auth

#### Register Tenant

```http
POST /auth/register
Content-Type: application/json

{
  "email": "admin@newcompany.com",
  "password": "SecurePass123!",
  "tenantName": "New Company Inc"
}
```

#### Reset Password Request

```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "user@company.com"
}
```

#### Reset Password

```http
POST /auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass456!"
}
```

#### Enable MFA

```http
POST /profile/mfa/enable
```

**Response:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

#### Verify MFA

```http
POST /profile/mfa/verify
Content-Type: application/json

{
  "token": "123456"
}
```

---

### Cases

#### List Cases

```http
GET /cases?page=1&limit=20&status=open
```

**Response:**
```json
{
  "data": [
    {
      "id": "case_abc123",
      "title": "Ransomware Investigation",
      "description": "Detected encryption activity on host WIN-SERVER-01",
      "status": "in_progress",
      "severity": "critical",
      "assignee": {
        "id": "usr_456",
        "email": "analyst@company.com"
      },
      "createdAt": "2024-12-16T09:00:00Z",
      "updatedAt": "2024-12-16T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### Get Case Details

```http
GET /cases/:id
```

#### Create Case

```http
POST /cases
Content-Type: application/json

{
  "title": "Suspicious Login Activity",
  "description": "Multiple failed login attempts from unknown IP",
  "severity": "high",
  "assignee": "usr_789"
}
```

**Response:**
```json
{
  "message": "Case created successfully",
  "case": {
    "id": "case_xyz789",
    "title": "Suspicious Login Activity",
    "status": "open",
    ...
  }
}
```

#### Update Case

```http
PUT /cases/:id
Content-Type: application/json

{
  "status": "resolved",
  "resolution": "False positive - VPN connection from home"
}
```

#### Add Note to Case

```http
POST /cases/:id/notes
Content-Type: application/json

{
  "content": "Contacted user, confirmed legitimate activity."
}
```

---

### Alerts

#### List Alerts

```http
GET /alerts?severity=critical&limit=50
```

**Response:**
```json
{
  "data": [
    {
      "id": "alert_123",
      "title": "Malware Detected",
      "severity": "critical",
      "provider": "crowdstrike",
      "timestamp": "2024-12-16T09:15:00Z",
      "source": {
        "hostname": "LAPTOP-USER01",
        "ip": "192.168.1.100"
      },
      "details": {
        "malware_family": "TrickBot",
        "file_path": "C:\\Users\\John\\Downloads\\invoice.exe"
      }
    }
  ]
}
```

#### Get Alert Details

```http
GET /alerts/:id
```

#### Create Case from Alert

```http
POST /alerts/:id/create-case
Content-Type: application/json

{
  "title": "Investigation: TrickBot Malware",
  "severity": "critical"
}
```

---

### Logs

#### Query Logs

```http
POST /logs/query
Content-Type: application/json

{
  "query": "SELECT * FROM security_events WHERE severity = 'high' LIMIT 100",
  "timeRange": {
    "start": "2024-12-15T00:00:00Z",
    "end": "2024-12-16T23:59:59Z"
  }
}
```

**Response:**
```json
{
  "data": [
    {
      "timestamp": "2024-12-16T09:30:00Z",
      "severity": "high",
      "message": "Failed login attempt",
      "source_ip": "203.0.113.45",
      "user": "admin"
    }
  ],
  "meta": {
    "count": 1,
    "executionTime": "45ms"
  }
}
```

#### Search Logs (Simplified)

```http
GET /logs?search=failed+login&page=1&limit=100
```

---

### Playbooks

#### List Playbooks

```http
GET /playbooks
```

**Response:**
```json
{
  "data": [
    {
      "id": "pb_123",
      "name": "Isolate Compromised Host",
      "description": "Quarantine endpoint via EDR",
      "steps": 5,
      "active": true
    }
  ]
}
```

#### Get Playbook Details

```http
GET /playbooks/:id
```

#### Execute Playbook

```http
POST /playbooks/:id/execute
Content-Type: application/json

{
  "inputs": {
    "hostname": "LAPTOP-USER01",
    "reason": "Malware detected"
  },
  "caseId": "case_abc123"
}
```

**Response:**
```json
{
  "executionId": "exec_xyz789",
  "status": "running",
  "message": "Playbook execution started"
}
```

#### Get Execution Status

```http
GET /playbooks/executions/:executionId
```

**Response:**
```json
{
  "executionId": "exec_xyz789",
  "playbookId": "pb_123",
  "status": "completed",
  "steps": [
    {
      "name": "Isolate Host",
      "status": "success",
      "output": "Host isolated successfully"
    },
    {
      "name": "Send Notification",
      "status": "success",
      "output": "Slack message sent"
    }
  ],
  "startedAt": "2024-12-16T10:00:00Z",
  "completedAt": "2024-12-16T10:02:15Z"
}
```

---

### AI

#### Generate Query from Natural Language

```http
POST /ai/query
Content-Type: application/json

{
  "prompt": "Show me all failed SSH logins from China in the last 24 hours"
}
```

**Response:**
```json
{
  "query": "SELECT * FROM security_events WHERE event_type = 'ssh_login' AND status = 'failed' AND country = 'CN' AND timestamp > now() - interval 24 hour",
  "filters": {
    "event_type": "ssh_login",
    "status": "failed",
    "country": "CN"
  }
}
```

#### Summarize Case

```http
POST /ai/summarize/case/:caseId
```

**Response:**
```json
{
  "summary": "This incident involves a ransomware attack targeting WIN-SERVER-01...",
  "keyFindings": [
    "Initial compromise via phishing email",
    "Lateral movement to file server",
    "Encryption of 2,456 files"
  ],
  "recommendedActions": [
    "Isolate affected hosts",
    "Restore from backup dated 2024-12-15",
    "Reset credentials for compromised accounts"
  ]
}
```

#### Suggest Playbook

```http
POST /ai/suggest-playbook
Content-Type: application/json

{
  "alertId": "alert_123"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "playbookId": "pb_456",
      "name": "Ransomware Response",
      "confidence": 0.95,
      "reason": "Alert indicates file encryption activity"
    }
  ]
}
```

---

### System

#### Get System Health

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-16T10:45:00Z",
  "services": {
    "postgres": "healthy",
    "clickhouse": "healthy",
    "redis": "healthy"
  }
}
```

#### List Backups (Super Admin)

```http
GET /system/backups
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "backup_20241216_094500.sql.gz",
      "size": 524288000,
      "createdAt": "2024-12-16T09:45:00Z"
    }
  ]
}
```

#### Trigger Backup

```http
POST /system/backups
```

#### Get License Info

```http
GET /system/license
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "••••••••abc123",
    "status": "active",
    "users": 999,
    "retention": 3650,
    "expiresAt": "2025-12-31"
  }
}
```

#### Update License

```http
POST /system/license
Content-Type: application/json

{
  "key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Resource not found",
  "code": "NOT_FOUND",
  "details": {
    "resource": "case",
    "id": "case_invalid"
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

### Common Error Codes

- `INVALID_CREDENTIALS` - Login failed
- `TOKEN_EXPIRED` - JWT expired, refresh required
- `INSUFFICIENT_PERMISSIONS` - RBAC denied
- `RESOURCE_NOT_FOUND` - Entity doesn't exist
- `VALIDATION_ERROR` - Request body validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Rate Limiting

**Default Limits:**
- 100 requests per minute per IP
- 1000 requests per hour per user

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1702735200
```

**429 Response:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Webhooks

### Configuring Webhooks

```http
POST /settings/webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["alert.created", "case.updated"],
  "secret": "webhook_secret_key"
}
```

### Webhook Events

- `alert.created` - New alert generated
- `alert.updated` - Alert status changed
- `case.created` - New case opened
- `case.updated` - Case status/assignee changed
- `playbook.completed` - Playbook execution finished

### Webhook Payload Example

```json
{
  "event": "alert.created",
  "timestamp": "2024-12-16T11:00:00Z",
  "data": {
    "id": "alert_789",
    "title": "Malware Detected",
    "severity": "critical",
    "provider": "crowdstrike"
  }
}
```

### Verifying Webhook Signatures

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return digest === signature;
}

// In your webhook handler
const signature = req.headers['x-zcr-signature'];
const isValid = verifySignature(req.body, signature, 'webhook_secret_key');
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://app.zcr.ai/api',
  withCredentials: true,
});

// Login
await client.post('/auth/login', {
  email: 'analyst@company.com',
  password: 'SecurePass123'
});

// Get cases
const { data } = await client.get('/cases', {
  params: { status: 'open', limit: 50 }
});

console.log(data);
```

### Python

```python
import requests

BASE_URL = 'https://app.zcr.ai/api'
session = requests.Session()

# Login
session.post(f'{BASE_URL}/auth/login', json={
    'email': 'analyst@company.com',
    'password': 'SecurePass123'
})

# Get cases
response = session.get(f'{BASE_URL}/cases', params={
    'status': 'open',
    'limit': 50
})

cases = response.json()
print(cases)
```

### cURL

```bash
# Login and save cookies
curl -X POST https://app.zcr.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"analyst@company.com","password":"SecurePass123"}' \
  -c cookies.txt

# Use session
curl -X GET https://app.zcr.ai/api/cases?status=open \
  -b cookies.txt
```

---

## Interactive API Explorer

Visit the **Swagger UI** for live API testing:

🔗 **https://app.zcr.ai/swagger**

---

## Support

- **API Issues**: api-support@zcr.ai
- **Documentation**: [docs.zcr.ai/api](https://docs.zcr.ai/api)
- **Status Page**: [status.zcr.ai](https://status.zcr.ai)

---

**Happy Building! 🚀**
