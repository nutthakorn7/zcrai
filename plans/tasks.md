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
- [x] Implement Log Retention Policies (Hot/Warm/Cold)

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
- [x] Handle deduplication

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

## Phase 6: Dashboard & Log Viewer (Week 12-14) ✅ COMPLETED

### 6.1 Dashboard API
- [x] GET /api/dashboard/summary (counts by severity)
- [x] GET /api/dashboard/timeline (events over time)
- [x] GET /api/dashboard/top-hosts
- [x] GET /api/dashboard/top-users
- [x] GET /api/dashboard/mitre-heatmap
- [x] GET /api/dashboard/sources (sources breakdown)
- [x] GET /api/dashboard/integrations (integration breakdown)
- [x] GET /api/dashboard/sites (S1 site breakdown)

### 6.2 Log Viewer API
- [x] GET /api/logs (paginated, filtered, sorted)
- [x] GET /api/logs/:id (single log detail)
- [x] GET /api/logs/filters (filter options)
- [x] Search with filters (time range, severity, source, host, integration, site)

### 6.3 Dashboard UI
- [x] Overview cards (Critical, High, Medium, Low counts)
- [x] Timeline chart (Stacked Area Chart with Recharts)
- [x] Top affected hosts table
- [x] Top affected users table
- [x] Sources pie chart
- [x] Integrations table
- [x] S1 Sites table
- [x] MITRE ATT&CK bar chart
- [x] Time range selector (1/7/30/90 days)

### 6.4 Log Viewer UI
- [x] Log list with pagination
- [x] Advanced filter panel (severity, source, integration, S1 account, S1 site)
- [x] Log detail modal (with integration/site info)
- [x] Export to CSV

---

## Phase 7: Conversational UI (CUI) AI Chat bot (Week 15-16)

### 7.1 AI Chat Backend (CUI Brain)
- [x] Setup AI Service (Support OpenAI, Anthropic)
- [ ] Setup AI Service (Support Local LLM/Ollama)
- [x] Implement Streaming API for Chat (`POST /api/ai/chat`)
- [x] Context Management (Attach current page context, selected logs)
- [x] System Prompts for Security Analyst Persona
- [x] Tool calling (Allow AI to query DB: `get_summary`, `search_logs`, `get_integrations`, `get_top_threats`)

### 7.2 Chat Widget UI
- [x] Floating Action Button (FAB) for Chat
- [x] Chat Window (Expandable/Collapsible)
- [x] Message Bubbles (User vs AI)
- [x] Markdown Rendering (Code blocks, Tables, Lists)
- [x] Loading/Typing Indicators
- [x] "Analyze This Page" context button

### 7.3 Advanced AI Features
- [x] Threat Analysis & Remediation suggestions (via Context + Prompt)
- [ ] Automated Query Generation (Natural Language to SQL/Filters)
- [ ] Incident Summarization
- [ ] Voice Input (Speech-to-Text) - Optional

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

## Phase 11: Super Admin / SaaS Owner Portal (Week 24-25)

### 11.1 Super Admin Role & Auth
- [x] Add `superadmin` role to RBAC system
- [x] Create Super Admin user seeding
- [x] Super Admin JWT with cross-tenant access
- [x] Protect Super Admin routes with role check

### 11.2 Tenant Management API
- [x] GET /api/admin/tenants (list all tenants with stats)
- [x] GET /api/admin/tenants/:id (tenant details)
- [x] PUT /api/admin/tenants/:id (enable/disable tenant)
- [x] GET /api/admin/tenants/:id/users (list users in tenant)
- [x] GET /api/admin/tenants/:id/stats (usage metrics)
- [x] POST /api/admin/impersonate/:tenantId (switch to view as tenant)

### 11.3 Cross-Tenant Data Access
- [x] Super Admin can view all tenants' logs
- [x] Tenant selector dropdown in header
- [x] Dashboard stats scoped to selected tenant
- [x] Log viewer filtered by selected tenant
- [x] Integration status per tenant

### 11.4 Super Admin Dashboard UI
- [x] Tenant overview table (name, users, events, status)
- [x] Tenant search and filter
- [x] Tenant detail page (stats, users, integrations)
- [x] Usage graphs (events/day per tenant)
- [x] System-wide alerts and health status (DB/Redis/ClickHouse Health Check)

### 11.5 Billing & Subscription (Optional)
- [ ] Subscription tier per tenant (Free, Pro, Enterprise)
- [ ] Usage limits enforcement
- [ ] Billing history view

---

## Phase 12: Testing & QA (Week 26-27)

### 12.1 Backend Testing
- [ ] Unit tests (Vitest) - services, utils
- [ ] Integration tests - API endpoints
- [ ] Auth flow tests
- [ ] RBAC permission tests

### 12.2 Frontend Testing
- [ ] Unit tests (Vitest) - components, hooks
- [ ] E2E tests (Playwright) - critical flows
- [ ] Login/Logout flow
- [ ] Dashboard navigation
- [ ] Case management flow

### 12.3 Security Testing
- [ ] SQL injection tests
- [ ] XSS tests
- [ ] CSRF tests
- [ ] Authentication bypass tests
- [ ] Tenant isolation tests

---

## Phase 13: Deployment (Week 28)

### 13.1 Infrastructure
- [x] Dockerfile for each service
- [x] Docker Compose for production
- [x] Nginx reverse proxy config
- [ ] SSL/TLS certificates (Let's Encrypt)
- [x] Environment variables setup

### 13.2 CI/CD
- [x] GitHub Actions workflow
- [x] Build + Test pipeline
- [x] Deploy to staging
- [x] Deploy to production

### 13.3 Monitoring
- [x] Health check endpoints
- [x] Error logging
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
| 11 | **Super Admin Portal** | 2 weeks |
| 12 | Testing | 2 weeks |
| 13 | Deployment | 1 week |
| **Total** | | **~28 weeks** |

---

## Current Progress

**Phase 1: Foundation** - 🔄 In Progress
- [x] Plans created (design, security, techstack)
- [ ] Project setup...
