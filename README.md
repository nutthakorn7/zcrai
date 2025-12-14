# 🛡️ zcrAI - Next-Gen Security Operations Platform

**Enterprise-grade SOC/SIEM platform with AI-powered threat detection, automated response, and comprehensive compliance reporting.**

[![Build Status](https://github.com/zrd4y/zcrAI/actions/workflows/test.yml/badge.svg)](https://github.com/zrd4y/zcrAI/actions)
[![Production Build](https://github.com/zrd4y/zcrAI/actions/workflows/deploy.yml/badge.svg)](https://github.com/zrd4y/zcrAI/actions)
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
- ✅ Behavioral anomaly detection
- ✅ MITRE ATT&CK mapping and heatmaps
- ✅ IOC enrichment (VirusTotal, AbuseIPDB)

### 📊 **Monitoring & Dashboards**
- ✅ Real-time security dashboards with 15+ widgets
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
- ✅ Generative AI case summarization (Gemini/OpenAI)
- ✅ AI-powered playbook recommendations
- ✅ Behavioral baselining and anomaly detection
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
- ✅ SentinelOne & CrowdStrike EDR connectors
- ✅ REST API with OpenAPI/Swagger docs
- ✅ Webhook support for custom integrations

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
git clone https://github.com/zrd4y/zcrAI.git
cd zcrAI
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

- [Feature Compliance Matrix](/.gemini/antigravity/brain/1bde7bba-e973-4828-a5a4-80d1200ba813/feature_compliance.md) - 88% RFP compliance
- [Walkthrough](/.gemini/antigravity/brain/1bde7bba-e973-4828-a5a4-80d1200ba813/walkthrough.md) - Development journey
- [API Documentation](http://localhost:8000/swagger) - OpenAPI Spec

---

## 🧪 Testing

```bash
# Backend unit tests
cd backend/api
bun test

# Frontend tests (if implemented)
cd frontend
npm test
```

---

## 📊 Feature Compliance: 88%

| Category | Score | Status |
|----------|-------|--------|
| SIEM & Log Management | 90% | ✅ Production Ready |
| Threat Detection | 85% | ✅ Production Ready |
| Alerting & Notification | 100% | ✅ Best in Class |
| Case Management | 100% | ✅ Best in Class |
| SOAR & Automation | 85% | ✅ Production Ready |
| AI & Analytics | 85% | ✅ Advanced |
| Reporting & Compliance | 95% | ✅ Best in Class |
| Access Control | 100% | ✅ Best in Class |

See [feature_compliance.md](/.gemini/antigravity/brain/1bde7bba-e973-4828-a5a4-80d1200ba813/feature_compliance.md) for detailed breakdown.

---

## 🗺️ Roadmap

### ✅ Phase 1-5 (Completed)
- [x] Core SIEM capabilities
- [x] Case management
- [x] Playbook automation (SOAR)
- [x] AI investigation & recommendations
- [x] Production infrastructure

### 🔜 Future Enhancements
- [ ] Real-time ML anomaly detection
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

**zrd4y** - [GitHub](https://github.com/zrd4y)

---

## 🙏 Acknowledgments

- Built with [Bun](https://bun.sh) and [Elysia.js](https://elysiajs.com)
- AI powered by [Google Gemini](https://ai.google.dev)
- Inspired by industry-leading SOC platforms

---

**⭐ Star this repo if you find it useful!**
