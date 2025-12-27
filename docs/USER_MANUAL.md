# zcrAI User Manual & Workflow Guide

Welcome to the **zcrAI** platform documentation. This guide outlines the core security operations workflows and how to use key features of the application.

---

## 🚀 Core Workflows

The zcrAI platform is designed around the standard SOC lifecycle: **Monitor -> Detect -> Investigate -> Respond**.

### 1. Monitor (Dashboard)
**Page**: `Dashboard` (Home)
- **Purpose**: Get a high-level overview of your security posture.
- **Key Actions**:
    - View **Total Active Cases** and **MTTR (Mean Time to Respond)** metrics.
    - Monitor **Events per Second (EPS)** to ensure data ingestion is healthy.
    - Check the **MITRE ATT&CK Matrix** coverage map.

### 2. Detect (Rules & Alerts)
**Pages**: 
- `Settings > Detection Rules` (`/detection`)
- `Alerts` (`/alerts`)

**Workflow**:
1.  **Manage Rules**: Go to **Detection Rules**. Here you can view Sigma-based detection rules active in the system.
2.  **Incoming Threats**: When a rule is triggered, it generates an **Alert**.
3.  **Triage**: Go to the **Alerts** page to view raw alerts before they become full cases.

### 3. Investigate (Cases & Observables)
**Pages**: 
- `Case Board` (`/cases`)
- `Threat Intel` (`/threat-intel`)

**Workflow**:
1.  **Case Management**: Alerts are grouped into **Cases**. Use the **Case Board** (Kanban view) to track status (`Open` -> `In Progress` -> `Resolved`).
2.  **Deep Dive**: Click on a case to see timeline, affected assets, and evidence.
3.  **Analyze Indicators**: Use **Threat Intel** page to search for specific IPs, Hashes, or Domains to see their reputation score and known associations.

### 4. Respond (Playbooks)
**Page**: `Automation > Playbooks` (`/playbooks`)
- **Purpose**: Automate common response actions (e.g., Block IP, Isolate Host).
- **Actions**:
    - Enable/Disable automated playbooks.
    - View run history of automated actions.

---

## ⚙️ Configuration & Settings

### Notification Channels
**Page**: `Settings > Notification Channels` (`/settings/notifications`)
**Purpose**: Send real-time alerts to your team's chat apps.

**How to Setup**:
1.  Click **Add Channel**.
2.  **Channel Name**: Give it a name (e.g., "SOC Alerts").
3.  **Platform**: Select **Slack** or **Microsoft Teams**.
4.  **Webhook URL**: Paste the Incoming Webhook URL from your provider.
    *   *Slack*: `https://hooks.slack.com/services/...`
    *   *Teams*: `https://your-tenant.webhook.office.com/...`
5.  Click **Test Connection** to verify integration.
6.  **Rules**: Set minimum severity (e.g., `Medium+`) to filter noise.

### Subscription & Billing
**Page**: `Settings > Subscription` (`/settings/subscription`)
- **Purpose**: Manage your license and usage limits.
- **Info Available**:
    - **Current Tier**: Free, Pro, or Enterprise.
    - **Usage**: Number of Users, Data Retention (days), and Data Volume (GB).
    - **Status**: Active or Past Due.

### Integrations
**Page**: `Settings > Integrations` (`/settings/integrations`)
- **Purpose**: Connect external security tools.
- **Supported Integrations**:
    - **CrowdStrike / SentinelOne**: For EDR data & response.
    - **VirusTotal / AbuseIPDB**: For enrichment.
    - **OpenAI**: For AI-assisted monitoring.
- **Action**: Enter your API Keys here to enable these features.
