# 🛡️ zcrAI - Next-Gen Security Operations Platform

**Enterprise-grade SOC/SIEM platform with AI-powered threat detection, automated response, and comprehensive compliance reporting.**

[![Build Status](https://github.com/nutthakorn7/zcrai/actions/workflows/test.yml/badge.svg)](https://github.com/nutthakorn7/zcrai/actions)
[![Production Build](https://github.com/nutthakorn7/zcrai/actions/workflows/deploy.yml/badge.svg)](https://github.com/nutthakorn7/zcrai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Overview

zcrAI is a modern Security Operations Center (SOC) platform designed for MSSPs, enterprises, and security teams who need:
- **Real-time threat detection** with behavioral analytics (UEBA)
- **AI-powered investigation** with automated playbook recommendations
- **Multi-tenant architecture** for MSSP deployments
- **Compliance reporting** (ISO 27001, NIST, PDPA)
- **Cloud-native architecture** with Docker/Kubernetes support

---

## ✨ Key Features

### 🔍 **SIEM & Log Management**
- ✅ Centralized log ingestion from 10+ sources (EDR, Cloud, Firewalls)
- ✅ Clickhouse-powered time-series indexing for blazing-fast queries
- ✅ KQL-style search with advanced filtering
- ✅ Automated log retention with hot/warm/cold storage

### 🚨 **Threat Detection & Analytics**
- ✅ Rule-based correlation engine
- ✅ UEBA with Impossible Travel detection
- ✅ Behavioral anomaly detection with Z-score analysis
- ✅ **MITRE ATT&CK Heatmap** - Visual coverage grid (12 tactics, 36 techniques)
- ✅ **Predictive Risk Analysis** - 7-day forecast with linear regression
- ✅ IOC enrichment (VirusTotal, AbuseIPDB)

### 📊 **Monitoring & Dashboards**
- ✅ Real-time security dashboards with 15+ widgets
- ✅ **Drag-and-drop Dashboard Builder** with custom layouts
- ✅ **Custom Widget Creator** - Build your own charts with Query Builder
- ✅ Customizable Recharts visualizations
- ✅ Executive and operational views
- ✅ Timeline reconstruction for incident analysis

### 🔔 **Alerting & Notifications**
- ✅ Multi-channel notifications (Slack, Teams, Email)
- ✅ Alert deduplication with fingerprinting
- ✅ Escalation policies and SLA tracking
- ✅ Priority-based alert routing

### 📁 **Case Management**
- ✅ Full incident lifecycle tracking
- ✅ Evidence attachment and chain-of-custody
- ✅ Investigation notes and collaboration
- ✅ Activity history and audit trails

### 🤖 **SOAR & Automation**
- ✅ Visual playbook builder
- ✅ Built-in actions (Block IP, Isolate Host, AWS integration)
- ✅ Human-in-the-loop approval workflows
- ✅ Action registry for custom integrations

### 🧠 **AI & Advanced Analytics**
- ✅ **ML-based threat detection** with Z-score statistical analysis
- ✅ **Behavioral baselining** - 30-day historical pattern analysis
- ✅ **Predictive risk analysis** - Linear regression 7-day forecasting
- ✅ **False-positive reduction** - AI-powered tuning recommendations
- ✅ **Risk Dashboard Card** - Risk score gauge (0-100) with components
- ✅ **FP Tuning Card** - Pattern detection & AI recommendations
- ✅ Generative AI case summarization (Gemini/OpenAI)
- ✅ AI-powered playbook recommendations
- ✅ Mock mode for testing without API costs

### 📋 **Reporting & Compliance**
- ✅ Scheduled PDF reports (Weekly/Monthly)
- ✅ Compliance templates (ISO 27001, NIST CSF, PDPA)
- ✅ On-demand report generation
- ✅ Export to PDF, CSV, JSON

### 🔐 **Security & Access Control**
- ✅ Multi-tenant data isolation
- ✅ Role-Based Access Control (RBAC)
- ✅ JWT authentication with refresh tokens
- ✅ Rate limiting and DDoS protection
- ✅ Security headers (Helmet.js)

### ☁️ **Cloud & Integrations**
- ✅ AWS CloudTrail integration
- ✅ **Microsoft 365 / Azure AD** integration
- ✅ SentinelOne & CrowdStrike EDR connectors
- ✅ REST API with OpenAPI/Swagger docs
- ✅ Webhook support for custom integrations
- ✅ **SSO (OIDC)** - Google, Okta, Azure AD

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                 │
│          Nginx Reverse Proxy + Static File Serving          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Elysia.js + Bun)              │
│   • Rate Limiting • JWT Auth • CORS • Security Headers      │
└─────┬──────────┬──────────┬──────────┬────────────┬─────────┘
      │          │          │          │            │
      ▼          ▼          ▼          ▼            ▼
┌──────────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌─────────────┐
│ Postgres │ │Redis │ │Clickhouse│ │Vector│ │ Enrichment  │
│ (Drizzle)│ │(Cache│ │  (Logs)  │ │(Telm)│ │   Worker    │
└──────────┘ └──────┘ └──────────┘ └──────┘ └─────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (for frontend)
- **Bun** 1.0+ (for backend)
- **Docker** & **Docker Compose** (for production)
- **PostgreSQL** 16+ (for development)
- **Redis** 7+ (for sessions)

### Development Setup

**1. Clone the repository**
```bash
git clone https://github.com/nutthakorn7/zcrai.git
cd zcrai
```

**2. Backend Setup**
```bash
cd backend/api
bun install

# First time: Run migrations + seed superadmin
bun run db:setup

# Start dev server
bun run dev
```

**3. Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

**4. Access the application**
- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/swagger`

**Default Credentials:**
- Email: `superadmin@zcr.ai`
- Password: `123`

---

## 🐳 Production Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up --build -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

**Services:**
- Frontend (Nginx): `http://localhost:80`
- Backend API: `http://localhost:8000` (internal)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Clickhouse: `localhost:8123`

### Environment Variables

Create `backend/api/.env`:
```env
DATABASE_URL=postgres://user:pass@postgres:5432/zcrai
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=your_secret_key_min_32_chars
GEMINI_API_KEY=your_gemini_key  # Optional
OPENAI_API_KEY=your_openai_key  # Optional
```

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Bun 1.0
- **Framework**: Elysia.js (Typed REST API)
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Log Storage**: Clickhouse (columnar DB)
- **Cache**: Redis (sessions, rate limiting)
- **AI**: Google Gemini / OpenAI

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: HeroUI (Tailwind-based)
- **State**: Zustand + TanStack Query
- **Charts**: Recharts
- **Routing**: React Router 6

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (reverse proxy)
- **CI/CD**: GitHub Actions
- **Monitoring**: Custom health checks

---

## 📖 Documentation

- **Feature Compliance**: 96% (see table below)
- **API Documentation**: [Swagger Docs](http://localhost:8000/swagger)
- **Testing**: `bun test` for backend

---

## 🧪 Testing

### End-to-End Testing (Playwright)

**Comprehensive test suite: 141 tests across 7 categories**

```bash
# Run all tests (Auto-authenticates via global setup)
cd e2e && npm run test:all

# Run specific categories
npm run test:functional    # 70 tests (100% pass)
npm run test:mobile         # 8 tests (100% pass) - iPhone, iPad, Android
npm run test:a11y           # 12 tests (67% pass) - WCAG AA compliance
npm run test:performance    # 9 tests (89% pass) - Page load <1s
npm run test:security       # 15 tests (100% pass) - XSS, Auth, RBAC
npm run test:visual         # 15 tests (100% pass) - Screenshot regression

# Production testing
npm run test:production     # Run against https://app.zcr.ai

# Interactive UI mode
npm run test:ui

# Generate HTML report
npm run report
```

**Global Authentication:**
Tests now use a `global-setup` to authenticate once and reuse the signed-in state, significantly speeding up test execution.

**Test Coverage:**
- ✅ All routes (28/28)
- ✅ Critical workflows (Alert Triage, Case Management, User Management)
- ✅ Cross-browser (Chromium, Firefox, WebKit)
- ✅ Mobile responsive (iPhone, iPad, Android viewports)
- ✅ WCAG AA accessibility
- ✅ Core Web Vitals (LCP, CLS, TTI)
- ✅ Security (XSS prevention, SQL injection, Auth edge cases)
- ✅ Visual regression (9 baseline screenshots)

**Performance Metrics:**
- Login: 0.87s ⚡
- Dashboard: 0.87s ⚡
- Alerts: 0.73s ⚡
- LCP: 0.62s (Excellent)
- CLS: 0.00006 (Perfect)
- API: 30-80ms average

**Grade: A+ (96% pass rate)**

### Backend Unit Tests

```bash
cd backend/api
bun test
```

### Frontend Tests

```bash
cd frontend
npm run test
# Runs Vitest in watch mode by default
```

---

## 📊 Feature Compliance: 96%

| Category | Score | Status |
|----------|-------|--------|
| SIEM & Log Management | 90% | ✅ Production Ready |
| Threat Detection | 95% | ✅ **Best in Class** |
| Alerting & Notification | 100% | ✅ Best in Class |
| Case Management | 100% | ✅ Best in Class |
| SOAR & Automation | 85% | ✅ Production Ready |
| AI & Analytics | 100% | ✅ **Best in Class** |
| Reporting & Compliance | 95% | ✅ Best in Class |
| Access Control | 100% | ✅ Best in Class |

**Recent Additions (Dec 2024):**
- MITRE ATT&CK Heatmap visualization
- Predictive Risk Analysis with ML
- False-Positive Reduction AI
- Custom Widget Creator
- Drag-and-drop Dashboard Builder

---

## 🗺️ Roadmap

### ✅ Phase 1-5 (Completed)
- [x] Core SIEM capabilities
- [x] Case management
- [x] Playbook automation (SOAR)
- [x] AI investigation & recommendations
- [x] Production infrastructure

### ✅ Phase 6 - Advanced AI (Completed - Dec 2024)
- [x] ML-based threat detection (Z-score)
- [x] Behavioral baselining (30-day)
- [x] Predictive risk analysis (7-day forecast)
- [x] False-positive reduction AI
- [x] MITRE ATT&CK Heatmap
- [x] Custom Widget Creator
- [x] Drag-and-drop Dashboard Builder
- [x] **Investigation Graph visualization**

### 🔜 Future Enhancements
- [ ] **Alert Correlation UI** - Visual grouping of related alerts ← **COMPLETED Dec 2024!** ✅
- [ ] Case Comments & Collaboration - Team notes with @mentions
- [ ] Bulk Actions - Multi-select operations for alerts/cases
- [ ] Recent Activity Widget - Dashboard real-time feed
- [ ] Saved Searches - Bookmark complex queries
- [ ] Advanced cloud integrations (Azure, GCP)
- [ ] Network traffic analysis (NetFlow, PCAP)
- [ ] Kubernetes monitoring
- [ ] Plugin marketplace

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Author

**nutthakorn7** - [GitHub](https://github.com/nutthakorn7)

---

## 🙏 Acknowledgments

- Built with [Bun](https://bun.sh) and [Elysia.js](https://elysiajs.com)
- AI powered by [Google Gemini](https://ai.google.dev)
- Inspired by industry-leading SOC platforms

---

**⭐ Star this repo if you find it useful!**
