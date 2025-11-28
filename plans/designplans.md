# zcrAI - SOC Dashboard Design Plan

## Core Features
1. zcrAI is a SOC Dashboard that can integrate with S1 and crwd, creating a multi-tenant user SaaS system.
2. zcrAI extracts logs from key fields from a pre-defined API and converts them into a single JSON structure via VECTOR, then transfers them to the ClickHouse DB.
3. zcrAI can utilize various AI providers to analyze various attacks or threats based on Mitre Attack and Cyber ​​Killchain principles.
4. zcrAI must not be hardcoded. The system uses .env files for configuration. Integration with AI, S1, crwd, or other providers requires users to manually enter their own data in the UI.
5. zcrAI uses HeroUI for the Dark Mode theme.
6. zcrAI is a SaaS system that can be used by multiple organizations.
7. Use only the provided folder, but if you don't have one, you can create one.

---

## Role-Based Access Control (RBAC)

### Multi-Tenant Structure
```
Platform (Super Admin)
├── Tenant A (Organization A)
│   ├── Tenant Admin
│   ├── SOC Analyst
│   └── Customer (Read-only)
├── Tenant B (Organization B)
│   ├── Tenant Admin
│   ├── SOC Analyst
│   └── Customer (Read-only)
└── ...
```

### Role Permissions

#### 0. Super Admin (Platform Owner)
| Permission | Access |
|------------|--------|
| Dashboard Overview (All Tenants) | ✅ |
| View Logs Detail (All Tenants) | ✅ |
| AI Analysis | ✅ |
| Export Report | ✅ |
| Create/Delete Tenants | ✅ |
| Manage All Users | ✅ |
| Edit Platform Config | ✅ |
| View Platform Analytics | ✅ |
| Billing Management | ✅ |
| System Health Monitoring | ✅ |

#### 1. Tenant Admin
| Permission | Access |
|------------|--------|
| Dashboard Overview | ✅ |
| View Logs Detail | ✅ |
| AI Analysis | ✅ |
| Export Report | ✅ |
| Edit Config/API Key (own tenant) | ✅ |
| Manage Users (own tenant) | ✅ |
| Close Cases | ✅ |
| Access Other Tenants | ❌ |

#### 2. SOC Analyst
| Permission | Access |
|------------|--------|
| Dashboard Overview | ✅ |
| View Logs Detail | ✅ |
| AI Analysis | ✅ |
| Export Report | ✅ |
| Close Cases | ✅ |
| Edit Config/API Key | ❌ |
| Manage Users | ❌ |
| Access Other Tenants | ❌ |

#### 3. Customer (Read-Only)
| Permission | Access |
|------------|--------|
| Dashboard Overview | ✅ |
| View Logs Detail | ✅ |
| AI Analysis | ✅ |
| Export Report | ✅ |
| Track Case Progress | ✅ (view SOC/Analyst work) |
| Close Cases | ❌ |
| Edit Config/API Key | ❌ |
| Manage Users | ❌ |
| Access Other Tenants | ❌ |

### Customer Portal Features
- **Dashboard Overview**: Security posture summary for their organization
- **Log Viewer**: Read-only access to security logs with search/filter
- **AI Analysis**: Request AI threat analysis on specific logs/alerts
- **Report Export**: Generate and download security reports (PDF/CSV)
- **Case Tracking**: Monitor case status and SOC analyst activities (who is working, progress updates)

---

## Case Workflow States

### State Diagram
```
[New] → [Triaging] → [Investigating] → [Escalated] → [Resolved] → [Closed]
                  ↓                   ↓
              [False Positive] ← ─ ─ ┘
```

### State Definitions
| State | Description | Who Can Transition |
|-------|-------------|--------------------|
| **New** | Alert created from log/detection | System (Auto) |
| **Triaging** | SOC reviewing initial alert | SOC Analyst |
| **Investigating** | Active investigation in progress | SOC Analyst |
| **Escalated** | Escalated to senior analyst or Tenant Admin | SOC Analyst, Tenant Admin |
| **Resolved** | Threat mitigated, pending closure | SOC Analyst, Tenant Admin |
| **Closed** | Case completed and archived | SOC Analyst, Tenant Admin |
| **False Positive** | Determined as non-threat | SOC Analyst, Tenant Admin |

### Case Metadata
- **Assigned To**: Current owner (SOC Analyst)
- **Severity**: Critical / High / Medium / Low / Info
- **MITRE ATT&CK**: Mapped tactics and techniques
- **Timeline**: All state transitions with timestamps
- **Notes**: Investigation notes and findings
- **Attachments**: Evidence files, screenshots

---

## Notification System

### Notification Channels
| Channel | Description |
|---------|-------------|
| **In-App** | Bell icon notifications in dashboard |
| **Email** | Email alerts for critical events |
| **Webhook** | Integration with Slack, Teams, etc. (future) |

### Notification Events for Customer
| Event | Trigger | Priority |
|-------|---------|----------|
| New Critical Alert | Severity = Critical | 🔴 High |
| New High Alert | Severity = High | 🟠 Medium |
| Case Status Changed | Any state transition | 🟡 Normal |
| Case Assigned | Analyst assigned to case | 🟡 Normal |
| Case Resolved | Case moved to Resolved | 🟢 Low |
| Case Closed | Case moved to Closed | 🟢 Low |
| Daily Summary | Daily digest at configured time | 🔵 Info |
| Weekly Report | Weekly report generated | 🔵 Info |

### Notification Settings (Per User)
- Enable/Disable per channel (In-App, Email)
- Enable/Disable per event type
- Quiet hours configuration
- Digest mode (batch notifications)

---

## Deployment Strategy

### Development Environment
- **Frontend**: Run native `bun run dev` (Vite HMR support)
- **Backend API**: Run native `bun run dev` (Hot reload)
- **Collector**: Run native `go run .`
- **Services**: Run via Docker Compose (PostgreSQL, ClickHouse, Redis, Vector)
- **Goal**: Maximize development speed and debugging experience

### Production Environment
- **All Components**: Fully containerized via Docker
- **Orchestration**: Docker Compose or Kubernetes
- **Web Server**: Nginx as reverse proxy
- **Goal**: Consistency, isolation, and security

---

## Best Practices
- Apply best practices for everything
- Security-first approach
- Data isolation between tenants
- Audit logging for all actions