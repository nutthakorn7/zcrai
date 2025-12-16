# zcrAI User Guide

Welcome to **zcrAI** - your AI-powered Security Operations Center platform. This guide will help you navigate the platform and make the most of its features.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Alerts](#alerts)
4. [Cases](#cases)
5. [Log Viewer](#log-viewer)
6. [Playbooks (SOAR)](#playbooks-soar)
7. [Threat Intelligence](#threat-intelligence)
8. [Reports](#reports)
9. [Settings](#settings)
10. [AI-Powered Features](#ai-powered-features)

---

## Getting Started

### First Login

1. Navigate to your organization's zcrAI instance (e.g., `https://app.zcr.ai`)
2. Enter your **email** and **password**
3. If MFA is enabled, enter your **6-digit code** from your authenticator app
4. Click **Sign In**

### User Roles

- **SuperAdmin**: Full platform access, manage all tenants
- **Admin**: Manage tenant settings, users, integrations
- **Analyst**: Investigate alerts, create cases, run playbooks
- **Viewer**: Read-only access to dashboards and reports

---

## Dashboard

### Overview

The Dashboard is your command center, displaying:
- **Active Alerts**: Real-time security incidents
- **Open Cases**: Ongoing investigations
- **Recent Activity**: Latest security events
- **Threat Trends**: Visual analytics

### Custom Widgets

1. Click **Dashboard** > **Builder** in the sidebar
2. Drag widgets from the palette to the grid
3. Resize and arrange widgets
4. Click **Save** to persist your layout

### Filters

Use the top bar to filter data:
- **Time Range**: Last 24h, 7d, 30d, Custom
- **Severity**: Critical, High, Medium, Low
- **Provider**: CrowdStrike, SentinelOne, etc.

---

## Alerts

### Viewing Alerts

1. Click **Alerts** in the sidebar
2. Browse the table of security alerts
3. Click on any alert to view details

### Alert Details

Each alert shows:
- **Summary**: AI-generated description
- **Severity**: Risk level
- **Timeline**: Event sequence
- **Related Events**: Correlated logs
- **Observables**: IOCs (IPs, domains, hashes)

### Alert Actions

- **Create Case**: Escalate to investigation
- **Assign**: Assign to analyst
- **Dismiss**: Mark as false positive
- **Export**: Download as JSON/CSV

### AI Summarization

Click **Summarize with AI** to generate:
- Natural language summary
- Recommended actions
- Suggested playbook

---

## Cases

### Creating a Case

**Method 1: From Alert**
1. Open an alert
2. Click **Create Case**
3. Review pre-filled details
4. Click **Create**

**Method 2: Manual**
1. Click **Cases** > **New Case**
2. Fill in:
   - **Title**: Brief description
   - **Description**: Detailed information
   - **Severity**: Critical/High/Medium/Low
   - **Assignee**: Select analyst
3. Click **Create**

### Case Workflow

```
Open → In Progress → Resolved → Closed
```

- **Open**: Newly created
- **In Progress**: Active investigation
- **Resolved**: Solution identified
- **Closed**: Incident complete

### Case Timeline

The timeline tracks:
- **Notes**: Analyst observations
- **Actions**: Playbook executions
- **Status Changes**: Workflow progression
- **Evidence**: Attached files

### Collaborating

- **Add Note**: Document findings
- **Assign User**: Delegate to team member
- **Attach Evidence**: Upload screenshots, logs, memory dumps
- **Link Alerts**: Associate related incidents

---

## Log Viewer

### Searching Logs

**Basic Search**
1. Enter keywords in the search bar
2. Click **Search** or press Enter

**AI-Powered Search** 🤖
1. Type natural language query:
   - "Show failed logins from China"
   - "Critical alerts in last 2 hours"
2. AI converts to filters automatically

### Filters

- **Time Range**: Custom date picker
- **Severity**: Multi-select
- **Provider**: EDR/SIEM source
- **Custom Filters**: Field-level filtering

### Log Details

Click any log entry to expand:
- **Raw Data**: Complete JSON
- **Parsed Fields**: Structured view
- **Actions**: Create alert, add to case

### Export

1. Apply desired filters
2. Click **Export** button
3. Choose format: CSV, JSON, PDF
4. Download file

---

## Playbooks (SOAR)

### What are Playbooks?

Playbooks are **automated workflows** that respond to security incidents. They can:
- Isolate compromised hosts
- Block malicious IPs
- Send notifications
- Create tickets
- Collect forensics

### Running a Playbook

**Method 1: From Alert**
1. Open alert details
2. Click **Run Playbook**
3. Select suggested playbook
4. Click **Execute**

**Method 2: Manual**
1. Navigate to **Playbooks**
2. Find desired playbook
3. Click **Run**
4. Fill in required inputs
5. Click **Execute**

### Monitoring Execution

1. Click **Playbooks** > **Executions**
2. View real-time progress
3. Check step statuses
4. Review outputs

### Approvals

For sensitive actions:
1. Playbook pauses at **Approval** step
2. Navigate to **Approvals** (bell icon)
3. Review request details
4. Click **Approve** or **Reject**

### Creating Playbooks

1. Click **Playbooks** > **New Playbook**
2. Drag steps from the palette:
   - **Isolate Host** (EDR)
   - **Block IP** (Firewall)
   - **Send Notification** (Slack/Email)
   - **Wait for Approval** (Human decision)
3. Connect steps with arrows
4. Configure step parameters
5. Click **Save**

---

## Threat Intelligence

### IOC Management

**Manually Add IOC**
1. Click **Threat Intel** > **Observables**
2. Click **Add Observable**
3. Enter:
   - **Type**: IP, Domain, Hash, URL
   - **Value**: The indicator
   - **Tags**: Labels for organization
4. Click **Save**

**Bulk Import**
1. Click **Import**
2. Upload CSV or STIX file
3. Review preview
4. Click **Confirm**

### Historical Lookup

**Retroactive Scan**
1. Go to **Threat Intel** > **Observables**
2. Select IOC
3. Click **Actions** > **Scan Historical Logs**
4. Select time range
5. Click **Scan**
6. View results

### Threat Feeds

Enabled integrations:
- **MISP**: Community threat intel
- **AlienVault OTX**: Open threat exchange
- **VirusTotal**: File/URL reputation

**Configure Feed**
1. Go to **Settings** > **Integrations**
2. Click feed card (e.g., MISP)
3. Enter **API Key**
4. Click **Save**

---

## Reports

### Generating Reports

1. Click **Reports** in sidebar
2. Click **New Report**
3. Configure:
   - **Template**: Executive Summary, Technical Analysis
   - **Time Range**: Custom date range
   - **Scope**: All alerts, specific case, custom filter
4. Click **Generate**

### Scheduled Reports

1. Click **Reports** > **Schedules**
2. Click **New Schedule**
3. Set:
   - **Frequency**: Daily, Weekly, Monthly
   - **Recipients**: Email addresses
   - **Format**: PDF, CSV
4. Click **Save**

### Report Sections

- **Executive Summary**: High-level overview
- **Alert Statistics**: Volume, severity trends
- **Top Threats**: Most critical incidents
- **Response Metrics**: MTTR, MTTD
- **Recommendations**: AI-generated next steps

---

## Settings

### Profile

**Update Profile**
1. Click your avatar > **Profile**
2. Update fields:
   - Name
   - Email
   - Notification Preferences
3. Click **Save**

**Change Password**
1. Go to **Profile** > **Security**
2. Enter current password
3. Enter new password (2x)
4. Click **Update**

### Multi-Factor Authentication (MFA)

**Enable MFA**
1. Go to **Profile** > **Security**
2. Click **Enable MFA**
3. Scan QR code with authenticator app (Google Authenticator, Authy)
4. Enter 6-digit code
5. Save backup codes

### User Management (Admin Only)

**Invite User**
1. Go to **Settings** > **Users**
2. Click **Invite User**
3. Enter:
   - Email
   - Role (Admin, Analyst, Viewer)
4. Click **Send Invitation**

**Manage Roles**
1. Find user in table
2. Click **Edit**
3. Change role
4. Click **Save**

### Integrations (Admin Only)

**Configure EDR**
1. Go to **Settings** > **Integrations**
2. Click **CrowdStrike** (or SentinelOne, etc.)
3. Enter credentials:
   - API Client ID
   - API Secret
4. Test connection
5. Click **Save**

**Configure SIEM Export**
1. Go to **Integrations** > **SIEM**
2. Select provider (Splunk, QRadar, Elastic)
3. Enter endpoint URL and credentials
4. Click **Save**

### System (Super Admin Only)

**Backups**
1. Go to **Settings** > **System** > **Backups**
2. Click **Trigger Backup**
3. Wait for completion
4. Download backup file

**License**
1. Go to **Settings** > **System** > **License**
2. Review current license status
3. To update:
   - Paste new license key
   - Click **Activate**

---

## AI-Powered Features

### Natural Language Query

**Log Viewer**
1. Type question in plain English:
   - "Show me failed SSH attempts"
   - "Critical alerts from Windows servers"
2. Press Enter
3. AI generates filters automatically

### Case Summarization

1. Open any case
2. Click **Summarize with AI**
3. Wait 2-3 seconds
4. Review AI-generated summary

### Playbook Suggestions

1. Open alert details
2. Click **Set Page Context** (for AI awareness)
3. Ask AI: "What playbook should I run?"
4. Review suggestions
5. Click suggested playbook to execute

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Global search |
| `Ctrl+N` | New case |
| `Ctrl+/` | Show shortcuts |
| `Esc` | Close modal |

---

## Tips & Best Practices

### For Analysts

1. **Enable notifications** for high-severity alerts
2. **Use playbooks** to automate repetitive tasks
3. **Document everything** in case timeline
4. **Tag observables** for easy retrieval

### For Admins

1. **Review user activity** regularly (Audit Logs)
2. **Test integrations** weekly
3. **Configure data retention** based on compliance needs
4. **Monitor license limits** (Settings > System)

### For Security

1. **Enable MFA** for all users
2. **Use SSO** for centralized authentication
3. **Rotate API keys** quarterly
4. **Backup database** weekly

---

## Troubleshooting

### Cannot Login

- **Check credentials**: Ensure Caps Lock is off
- **MFA code expired**: Wait for new code (30s cycle)
- **Account locked**: Contact admin after 5 failed attempts

### Missing Alerts

- **Check filters**: Reset to "All" severity
- **Integration status**: Verify EDR connection in Settings
- **Time range**: Expand to last 7 days

### Playbook Failed

1. Go to **Playbooks** > **Executions**
2. Click failed execution
3. Check error message in failed step
4. Common issues:
   - Invalid API credentials
   - Network timeout
   - Insufficient permissions

### Slow Performance

- **Clear browser cache**: Ctrl+Shift+Del
- **Check data volume**: Large queries may take time
- **Contact support**: If persistent

---

## Getting Help

- **In-App Chat**: Click ? icon in bottom right
- **Documentation**: [docs.zcr.ai](https://docs.zcr.ai)
- **Support Email**: support@zcr.ai
- **Community**: [community.zcr.ai](https://community.zcr.ai)

---

**Need more help?** Contact your organization's administrator or reach out to our support team!
