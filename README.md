# zcrAI - Next-Gen Autonomous AI SOC Platform

> **The World's First Zero-Touch AI Security Operations Center**
> Built for Enterprise SOC Teams and Managed Security Service Providers (MSSPs).

[![Deploy Status](https://img.shields.io/badge/deploy-production-success)](https://app.zcr.ai)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Engine](https://img.shields.io/badge/AI-Gemini%20Pro-blueviolet)](https://ai.google.dev)
[![DB](https://img.shields.io/badge/DB-PostgreSQL%20%2B%20ClickHouse-blue)](https://clickhouse.com)

## 🎯 Overview

**zcrAI** is a high-performance, autonomous Security Operations Center (SOC) platform. Unlike traditional SIEM/SOAR tools that require constant human intervention, zcrAI utilizes advanced Generative AI and a 5-tier Materialized View architecture to deliver a "Zero-Touch" experience. It doesn't just surface alerts; it investigates them, remediates threats autonomously, and provides detailed "AI Journeys" for full transparency.

**Production URL:** [https://app.zcr.ai](https://app.zcr.ai)

---

## ✨ Key Features (Enterprise Grade)

### 🤖 Zero-Touch AI SOC (New!)
- **Autonomous Remediation**: AI investigative engine that can isolate hosts, block IPs, and quarantine users with >90% confidence.
- **AI Journey Visualization**: A minimalist, Radiant Security-style UI that tells the story of an incident from detection to resolution.
- **Autonomous ROI**: Real-time tracking of analyst hours saved, threats neutralized, and response time reduction (avg. 1.2s).
- **Self-Healing Operations**: Automatic integration recovery and health monitoring via WebSockets.

### 🎭 Advanced AI Triage & Investigation
- **RAG-Powered Analysis**: Uses Retrieval Augmented Generation to compare new alerts against historical tenant data and user feedback.
- **Correlation Engine**: Automatically groups related events across hosts and users to identify attack chains (Lateral Movement, Data Exfiltration).
- **Auto-Escalation**: High-confidence True Positives are automatically promoted to cases and assigned priority.
- **False Positive Filter**: Dramatically reduces alert fatigue by auto-closing noise with verifiable AI reasoning.

### 🔄 Multi-Cloud SOAR (Security Orchestration)
- **Unified Action Registry**: One interface to rule them all—send EDR commands to CrowdStrike, SentinelOne, or Microsoft Defender.
- **Smart Playbooks**: Dynamic workflows that pause for "Human-in-the-Loop" approvals for high-impact actions.
- **Audit-Ready Actions**: Every automated action is logged with the "Why" (AI reasoning) and the "Who" (Tenant/System context).

### 🏢 World-Class MSSP & Enterprise Reporting
- **Global MSSP Dashboard**: Cross-tenant visibility for multi-customer deployments.
- **Compliance Templates**: One-click generation of NIST CSF, Thai PDPA, and ISO 27001 reports.
- **Scheduled Dispatcher**: Automatically email PDF reports to C-suite executives or technical teams.
- **Global IOC Hunt**: Search for Indicators of Compromise across all tenants in milliseconds using ClickHouse Bloom Filters.

### 📊 Optimized Data Architecture
- **5-Tier Materialized Views**: High-speed analytics powered by 15+ MVs, transforming 10M+ raw events into actionable metrics.
- **Tier 1 (Core)**: Mitre Enrichment & Real-time Timeline.
- **Tier 2 (Intel)**: IOC tracking & Process Baselines.
- **Tier 3 (Ops)**: Entity (Host/User) hygiene & Integration SLAs.
- **Tier 4 (Compliance)**: Audit logs & Retention metrics.
- **Tier 5 (UEBA)**: Advanced User Behavior & Attack Chain correlation.

---

## ⚡ Performance Optimizations (Dec 2024)

### CPU Optimization Results

| Component | Before | After | Improvement |
|-----------|--------|-------|-------------|
| **Collector CPU** | 168% | 0.02% | ⬇️ 99.99% |
| **ClickHouse CPU** | 320% | 9.7% | ⬇️ 97% |
| **URL Query** | 100s | 0.01s | ⬇️ 10,000x faster |

### Key Optimizations

1. **Data Ingestion**
   - Full Sync: 365 → 30 days (92% less data)
   - Page Delay: 50ms → 200ms (reduced API pressure)
   - Batch Insert: 500 → 5,000 rows (reduced ClickHouse overhead)
   - Incremental Checkpointing: Resume from crash point

2. **Query Performance**
   - Added `url_hash` column (replaces JSONExtract - 10,000x faster)
   - 21 Materialized Views for dashboard analytics
   - TTL 90 days for automatic data cleanup

3. **Session Management**
   - JWT Access Token: 15m → 2h (less re-login)
   - Auto-refresh token on 401 (seamless experience)

4. **Disk Management**
   - Automatic cleanup when disk > 80%
   - TTL-based data expiration (90 days)

---

## 🏗️ Architecture Stack

### 🚀 Performance Stack
- **Backend API**: [Bun](https://bun.sh) + [Elysia.js](https://elysiajs.com) (Native performance, <2ms overhead).
- **Primary Database**: [PostgreSQL 16](https://www.postgresql.org) for metadata, RBAC, and SOAR configs.
- **Analytics Engine**: [ClickHouse 24](https://clickhouse.com) for ultra-fast security event processing.
- **Caching & Pub/Sub**: [Redis 7](https://redis.io) for real-time WebSocket signals and query caching.
- **Ingestion**: [Vector](https://vector.dev) for high-performance log normalization.

### 🎨 Design & UX
- **Frontend**: React 18 + Vite ([HeroUI](https://heroui.com) for premium components).
- **State Management**: TanStack Query + Zustand.
- **Real-time**: WebSocket (Native Elysia) for instant alerts and health updates.

---

## 🚀 Quick Start

### Prerequisites
- **Bun 1.0+** (Recommended) or Node.js 20+
- **Docker Desktop**
- **Git**

### Installation

```bash
# 1. Clone & Enter
git clone https://github.com/nutthakorn7/zcrai.git
cd zcrai

# 2. Spin up Infrastructure (PG, CH, Redis)
docker-compose up -d

# 3. Setup Backend
cd backend/api
bun install
bun run db:push
bun run dev

# 4. Setup Frontend (New Tab)
cd frontend
npm install
npm run dev
```

### Access Points
- **Web Interface**: `http://localhost:5173`
- **API Swagger**: `http://localhost:8000/swagger`
- **Default SuperAdmin**: `superadmin@zcr.ai` / `SuperAdmin@123!`

---

## 🔑 Enterprise Licensing

zcrAI includes a built-in enterprise licensing engine. Features like **Autopilot**, **MSSP Dashboard**, and **PDPA Reporting** require an active license.

**Generate a dev license:**
```bash
cd backend/api
bun run scripts/generate_license.ts --users 100 --retention 365 --expiry 1y
```

---

## 🧪 Testing & Quality

- **Unit/Integration**: `bun test` (Backend), `npm test` (Frontend).
- **E2E**: `npx playwright test` (Chrome/Firefox/Safari).
- **Coverage**: Full coverage reports generated via Vitest.

---

## 🚢 Deployment (Self-Hosted/Hybrid)

zcrAI is designed to run anywhere.
1. **Docker**: Simple one-command deployment.
2. **Kubernetes**: Helm charts available for high-scale MSSP deployments.
3. **Hybrid**: Keep ClickHouse data on-prem while using zcrAI Cloud for management.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full breakdown.

---

**Made with ❤️ for Modern Security Teams. Together, we make "Zero-Touch" a reality.**
