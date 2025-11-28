# zcrAI - Development Tasks

## Phase 1: Foundation (Week 1-2)

### 1.1 Project Setup
- [x] Initialize monorepo structure
- [x] Setup Docker Compose (PostgreSQL, ClickHouse, Redis)
- [x] Setup Elysia backend project with Bun
- [x] Setup React + Vite frontend project
- [x] Configure ESLint, Prettier, TypeScript
- [x] Setup Vitest for backend/frontend

### 1.2 Database Schema (PostgreSQL)
- [x] Design ERD diagram
- [x] Create tables: tenants, users, roles, permissions
- [x] Create tables: user_sessions, refresh_tokens
- [x] Create tables: api_keys (encrypted), audit_logs
- [x] Setup Drizzle ORM + migrations
- [x] Implement Row-Level Security (RLS) for tenant isolation

### 1.3 Database Schema (ClickHouse)
- [ ] Design schema for security logs
- [ ] Create tables: security_events, normalized_logs
- [ ] Create tables: cases, case_history
- [ ] Setup retention policies (1 years default)

---

## Phase 2: Authentication & Authorization (Week 3-4)

### 2.1 Auth Backend (Elysia)
- [x] POST /api/auth/register (Super Admin creates tenant + admin)
- [x] POST /api/auth/login (email + password)
- [x] POST /api/auth/logout
- [x] POST /api/auth/refresh (token rotation)
- [x] POST /api/auth/forgot-password
- [x] POST /api/auth/reset-password

### 2.2 Session Management
- [x] Implement HttpOnly Cookie (access_token, refresh_token)
- [x] Implement Redis session store
- [x] Implement token rotation + reuse detection
- [x] Implement account lockout (5 failed attempts)

### 2.3 MFA
- [x] POST /api/auth/mfa/setup (generate TOTP secret)
- [x] POST /api/auth/mfa/verify (verify TOTP code)
- [x] POST /api/auth/mfa/disable
- [x] Generate backup codes

### 2.4 RBAC Middleware
- [x] Create permission middleware
- [x] Implement role checks (Super Admin, Tenant Admin, SOC, Customer)
- [x] Implement tenant isolation middleware
- [x] Create audit logging middleware

### 2.5 Auth Frontend
- [x] Login page (email + password)
- [x] Add MFA support to Login page
- [x] Forgot password page
- [x] Reset password page
- [x] Session management UI (view/revoke sessions)

---

## Phase 3: Tenant & User Management (Week 5-6)

### 3.1 Tenant Management (Super Admin only)
- [x] GET /api/tenants (list all)
- [x] POST /api/tenants (create)
- [x] GET /api/tenants/:id
- [x] PUT /api/tenants/:id
- [x] DELETE /api/tenants/:id (soft delete)
- [x] Tenant settings UI

### 3.2 User Management (Tenant Admin)
- [x] GET /api/users (list users in tenant)
- [x] POST /api/users (invite user)
- [x] GET /api/users/:id
- [x] PUT /api/users/:id (update role, status)
- [x] DELETE /api/users/:id (soft delete)
- [x] User management UI

### 3.3 Profile Management (All users)
- [x] GET /api/profile
- [x] PUT /api/profile
- [x] PUT /api/profile/password
- [x] PUT /api/profile/mfa (setup, verify, disable)
- [x] Profile settings UI

---

## Phase 4: Integration Config (Week 7-8)

### 4.1 API Key Management
- [x] GET /api/integrations (list configured integrations)
- [x] POST /api/integrations/sentinelone (save S1 API key)
- [x] POST /api/integrations/crowdstrike (save CrowdStrike API key)
- [x] POST /api/integrations/ai/:provider (OpenAI, Claude, Gemini, etc.)
- [x] PUT /api/integrations/:id (update)
- [x] DELETE /api/integrations/:id
- [x] Test connection endpoint for each integration
- [x] Encrypt API keys with AES-256-GCM

### 4.2 Integration UI
- [x] Integration settings page
- [x] API key input forms (masked display)
- [x] Connection test button
- [x] Status indicators (connected/disconnected)

---

## Phase 5: Data Collection (Week 9-11)

### 5.1 Golang Collector Service
- [x] Setup Fiber project
- [x] Implement S1 API client (fetch alerts, threats)
- [x] Implement CrowdStrike API client (fetch detections)
- [x] Implement scheduled polling (configurable interval)
- [x] Error handling + retry logic

### 5.2 Vector Pipeline
- [x] Configure Vector sources (receive from Collector)
- [x] Create transform rules (normalize to unified schema)
- [x] Configure sink to ClickHouse
- [ ] Handle deduplication

### 5.3 Unified Log Schema
```
{
  "id": "uuid",
  "tenant_id": "uuid",
  "source": "sentinelone|crowdstrike",
  "timestamp": "ISO8601",
  "severity": "critical|high|medium|low|info",
  "event_type": "string",
  "mitre_tactic": "string",
  "mitre_technique": "string",
  "host": { "name", "ip", "os" },
  "user": { "name", "domain" },
  "process": { "name", "path", "cmd", "pid" },
  "file": { "name", "path", "hash" },
  "network": { "src_ip", "dst_ip", "port", "protocol" },
  "raw": { /* original payload */ }
}
```

---

## Phase 6: Dashboard & Log Viewer (Week 12-14)

### 6.1 Dashboard API
- [ ] GET /api/dashboard/summary (counts by severity)
- [ ] GET /api/dashboard/timeline (events over time)
- [ ] GET /api/dashboard/top-hosts
- [ ] GET /api/dashboard/top-users
- [ ] GET /api/dashboard/mitre-heatmap

### 6.2 Log Viewer API
- [ ] GET /api/logs (paginated, filtered, sorted)
- [ ] GET /api/logs/:id (single log detail)
- [ ] Search with filters (time range, severity, source, host, etc.)

### 6.3 Dashboard UI
- [ ] Overview cards (Critical, High, Medium, Low counts)
- [ ] Timeline chart (events per hour/day)
- [ ] Top affected hosts table
- [ ] Top affected users table
- [ ] MITRE ATT&CK heatmap visualization

### 6.4 Log Viewer UI
- [ ] Log list with virtual scrolling
- [ ] Advanced filter panel
- [ ] Log detail drawer/modal
- [ ] Export to CSV

---

## Phase 7: AI Analysis (Week 15-16)

### 7.1 AI Integration Backend
- [ ] POST /api/ai/analyze (analyze single log/alert)
- [ ] POST /api/ai/summarize (summarize multiple logs)
- [ ] Support multiple providers (OpenAI, Claude, local LLM)
- [ ] Rate limiting per tenant

### 7.2 AI Prompts
- [ ] Threat analysis prompt (MITRE ATT&CK mapping)
- [ ] Cyber Kill Chain mapping prompt
- [ ] Remediation recommendation prompt
- [ ] Summary/report generation prompt

### 7.3 AI UI
- [ ] "Analyze with AI" button on log detail
- [ ] AI response panel (formatted markdown)
- [ ] Copy/Export AI analysis
- [ ] AI usage quota display

---

## Phase 8: Case Management (Week 17-19)

### 8.1 Case API
- [ ] GET /api/cases (list cases with filters)
- [ ] POST /api/cases (create from log/alert)
- [ ] GET /api/cases/:id
- [ ] PUT /api/cases/:id (update status, assignee, notes)
- [ ] POST /api/cases/:id/comments
- [ ] POST /api/cases/:id/attachments

### 8.2 Case Workflow
- [ ] Implement state machine (New → Triaging → Investigating → Escalated → Resolved → Closed)
- [ ] State transition validation (who can transition)
- [ ] Auto-assignment rules (optional)
- [ ] SLA tracking (time in each state)

### 8.3 Case UI
- [ ] Case list view (Kanban or Table)
- [ ] Case detail page
- [ ] Status change dropdown
- [ ] Assignee selector
- [ ] Comments/Notes section
- [ ] Activity timeline
- [ ] Linked logs view

---

## Phase 9: Notifications (Week 20-21)

### 9.1 Notification Backend
- [ ] In-app notification system (store in PostgreSQL)
- [ ] GET /api/notifications
- [ ] PUT /api/notifications/:id/read
- [ ] Email notification service (SMTP)
- [ ] Notification preferences per user

### 9.2 Notification Triggers
- [ ] New critical/high alert → notify Customer
- [ ] Case status changed → notify Customer
- [ ] Case assigned → notify Analyst
- [ ] Daily/Weekly summary → scheduled job

### 9.3 Notification UI
- [ ] Bell icon with unread count
- [ ] Notification dropdown/panel
- [ ] Mark as read
- [ ] Notification settings page

---

## Phase 10: Reports & Export (Week 22-23)

### 10.1 Report API
- [ ] GET /api/reports/daily
- [ ] GET /api/reports/weekly
- [ ] GET /api/reports/monthly
- [ ] GET /api/reports/custom (date range)
- [ ] POST /api/reports/generate-pdf

### 10.2 Report UI
- [ ] Report dashboard
- [ ] Date range picker
- [ ] Preview report
- [ ] Download PDF/CSV

---

## Phase 11: Testing & QA (Week 24-25)

### 11.1 Backend Testing
- [ ] Unit tests (Vitest) - services, utils
- [ ] Integration tests - API endpoints
- [ ] Auth flow tests
- [ ] RBAC permission tests

### 11.2 Frontend Testing
- [ ] Unit tests (Vitest) - components, hooks
- [ ] E2E tests (Playwright) - critical flows
- [ ] Login/Logout flow
- [ ] Dashboard navigation
- [ ] Case management flow

### 11.3 Security Testing
- [ ] SQL injection tests
- [ ] XSS tests
- [ ] CSRF tests
- [ ] Authentication bypass tests
- [ ] Tenant isolation tests

---

## Phase 12: Deployment (Week 26)

### 12.1 Infrastructure
- [ ] Dockerfile for each service
- [ ] Docker Compose for production
- [ ] Nginx reverse proxy config
- [ ] SSL/TLS certificates (Let's Encrypt)
- [ ] Environment variables setup

### 12.2 CI/CD
- [ ] GitHub Actions workflow
- [ ] Build + Test pipeline
- [ ] Deploy to staging
- [ ] Deploy to production

### 12.3 Monitoring
- [ ] Health check endpoints
- [ ] Error logging
- [ ] Performance monitoring (optional: Prometheus/Grafana)

---

## Summary

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Foundation | 2 weeks |
| 2 | Auth & RBAC | 2 weeks |
| 3 | Tenant/User Management | 2 weeks |
| 4 | Integration Config | 2 weeks |
| 5 | Data Collection | 3 weeks |
| 6 | Dashboard & Logs | 3 weeks |
| 7 | AI Analysis | 2 weeks |
| 8 | Case Management | 3 weeks |
| 9 | Notifications | 2 weeks |
| 10 | Reports | 2 weeks |
| 11 | Testing | 2 weeks |
| 12 | Deployment | 1 week |
| **Total** | | **~26 weeks** |

---

## Current Progress

**Phase 1: Foundation** - 🔄 In Progress
- [x] Plans created (design, security, techstack)
- [ ] Project setup...
