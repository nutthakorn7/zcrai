# zcrAI - Enterprise Security Operations Platform

> **AI-Powered SOC Dashboard** for Security Teams & MSSPs

[![Deploy Status](https://img.shields.io/badge/deploy-production-success)](https://app.zcr.ai)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Overview

**zcrAI** is a comprehensive Security Operations Center (SOC) platform designed for enterprise security teams and Managed Security Service Providers (MSSPs). It combines **AI-powered threat analysis**, **automated response workflows (SOAR)**, and **multi-tenant architecture** to deliver a scalable, production-ready security solution.

**Production URL:** [https://app.zcr.ai](https://app.zcr.ai)

---

## ✨ Key Features

### 🔐 Core Security
- **Multi-Tenant RBAC**: Secure tenant isolation with role-based access control
- **SSO Integration**: SAML 2.0 support (Google, Okta, Azure AD)
- **MFA**: Time-based One-Time Password (TOTP) authentication
- **Audit Logging**: Complete audit trail for compliance

### 🤖 AI & Automation
- **Natural Language Queries**: AI-powered log search and filtering
- **Smart Case Summarization**: AI-generated incident summaries
- **Playbook Suggestions**: Context-aware response recommendations
- **Automated Query Generation**: Convert natural language to SQL/filters

### 📊 Data Collection & Analysis
- **Real-time Log Ingestion**: ClickHouse-powered high-volume data processing
- **EDR Integration**: CrowdStrike, SentinelOne, Microsoft Defender
- **SIEM Export**: Splunk, QRadar, Elastic integration
- **Threat Intelligence**: MISP, AlienVault OTX, VirusTotal feeds

### 🎭 Incident Response
- **Case Management**: Full lifecycle from detection to resolution
- **Alert Correlation**: Automatic grouping of related security events
- **Observable Tracking**: IOC management with retroactive scanning
- **Evidence Chain**: Forensic evidence preservation

### 🔄 SOAR (Security Orchestration)
- **Visual Playbook Builder**: Drag-and-drop workflow designer
- **Human-in-the-Loop**: Approval workflows for critical actions
- **Wait for Input**: Pause execution for manual data collection
- **Multi-Channel Notifications**: Slack, Teams, Email, PagerDuty

### 📈 Reporting & Compliance
- **PDF Report Generation**: Executive and technical reports
- **Custom Widgets**: Drag-and-drop dashboard builder
- **Scheduled Reports**: Automated delivery
- **Retention Management**: Configurable data retention policies

### 🏢 Enterprise Features
- **License Management**: JWT-based enterprise licensing
- **Backup & Restore**: Automated PostgreSQL backups
- **Usage Tracking**: Monitor user count, data volume
- **Billing Integration**: Tier-based quotas (Free, Pro, Enterprise)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20+ (or **Bun** 1.0+)
- **Docker** & Docker Compose
- **PostgreSQL** 16+
- **ClickHouse** 24+
- **Redis** 7+

### Installation

```bash
# Clone repository
git clone https://github.com/nutthakorn7/zcrai.git
cd zcrai

# Start infrastructure
docker-compose up -d

# Backend setup
cd backend/api
bun install
bun run db:push  # Run migrations
bun run index.ts

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# Access
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
# Swagger: http://localhost:8000/swagger
```

### Default Credentials
- **Email**: `superadmin@zcr.ai`
- **Password**: `SuperAdmin@123!` (change in production!)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  React + Vite + TailwindCSS + HeroUI + TanStack Query      │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────┴──────────────────────────────────┐
│                       Backend API                           │
│        Bun + Elysia.js + Drizzle ORM + Jose (JWT)          │
├─────────────────────────────────────────────────────────────┤
│  Services:  Auth │ RBAC │ AI │ SOAR │ Billing │ System     │
└──────┬──────────┬───────────────┬──────────────┬───────────┘
       │          │               │              │
   ┌───┴───┐  ┌───┴────┐     ┌────┴─────┐   ┌───┴────┐
   │ PG 16 │  │ CH 24  │     │ Redis 7  │   │ Vector │
   │Tenant │  │ Logs   │     │  Cache   │   │ Agent  │
   │ Users │  │ Events │     │  Sessions│   │ Ingest │
   └───────┘  └────────┘     └──────────┘   └────────┘
```

### Tech Stack
- **Frontend**: React 18, Vite, TanStack Query, HeroUI
- **Backend**: Bun 1.0, Elysia.js, Drizzle ORM
- **Database**: PostgreSQL 16 (metadata), ClickHouse 24 (logs)
- **Cache**: Redis 7
- **AI**: Google Gemini API
- **Auth**: JWT (jose), SAML 2.0
- **Testing**: Vitest, Playwright
- **CI/CD**: GitHub Actions
- **Deployment**: Nginx, PM2, Docker

---

## 📚 Documentation

- **[User Guide](docs/USER_GUIDE.md)** - End-user features and workflows
- **[API Documentation](docs/API_DOCS.md)** - Developer API reference
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment steps
- **[Walkthrough](walkthrough.md)** - Implementation notes

---

## 🧪 Testing

```bash
# Backend unit tests
cd backend/api
bun test

# Frontend unit tests
cd frontend
npm test

# E2E tests (Playwright)
cd e2e
npx playwright test
```

---

## 🚢 Deployment

### Production Deployment

```bash
# Set environment variables
export DATABASE_URL="postgres://..."
export CLICKHOUSE_URL="http://..."
export REDIS_URL="redis://..."
export JWT_SECRET="..."
export GOOGLE_GEMINI_API_KEY="..."

# Deploy via GitHub Actions
git push origin master

# Or manual deployment
./scripts/deploy.sh
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

---

## 🔑 License Management

### Generating Enterprise License

```bash
cd backend/api
bun run scripts/generate_license.ts --users 999 --retention 3650 --expiry 1y
```

### Activating License
1. Navigate to **Settings > System > License**
2. Paste the license key
3. Click **Activate**

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

---

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/nutthakorn7/zcrai/issues)
- **Email**: support@zcr.ai

---

## 🙏 Acknowledgments

Built with:
- [Bun](https://bun.sh)
- [Elysia.js](https://elysiajs.com)
- [React](https://react.dev)
- [ClickHouse](https://clickhouse.com)
- [Google Gemini](https://ai.google.dev)

---

**Made with ❤️ for Security Teams**
