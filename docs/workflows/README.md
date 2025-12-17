# Security Operations Workflow

The **zcrAI** platform is built around a streamlined **SOC Lifecycle**. This workflow ensures that threats are detected, analyzed, and neutralized efficiently.

```mermaid
graph LR
    A[Monitor] -->|Log Ingestion| B[Detect]
    B -->|Rule Match| C[Alert Triage]
    C -->|Promote| D[Investigate]
    D -->|IOC Analysis| E[Respond]
    E -->|Remediation| F[Close Case]
```

## Workflow to Page Mapping

Here is the direct map of which page to use for each step of the operation:

| Step | Operation Name | Primary Page | URL Path | Key Action |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Monitor** | **Dashboard** | `/` | Monitor KPI spikes & Health. |
| **2** | **Detect** | **Detection Rules** | `/detection` | Configure *what* to look for (Sigma). |
| **3** | **Triage** | **Alerts** | `/alerts` | Review incoming signals. Promote valid ones. |
| **4** | **Investigate** | **Case Board** | `/cases` | Manage incident status (Kanban). |
| **-** | *Deep Dive* | **Case Details** | `/cases/:id` | Timeline analysis & evidence review. |
| **-** | *Enrichment* | **Threat Intel** | `/threat-intel` | Search IP/Hash reputation. |
| **5** | **Respond** | **Playbooks** | `/playbooks` | Execute automated blocks & containment. |

## Detailed Breakdown

### 1. Monitor (Situational Awareness)
**Goal**: Keep an eye on the overall health of the organization.
*   **Action**: Analyst checks the **Dashboard** for spikes in `Active Cases` or `Events per Second (EPS)`.
*   **Page**: [Dashboard](monitor.md)


## 2. Detect (Automated Identification)
**Goal**: Find specific malicious patterns automatically.
*   **Mechanism**: **Detection Rules** (Sigma) scan incoming logs in real-time.
*   **Outcome**: When a match is found (e.g., "Mimikatz detected"), an **Alert** is generated.

## 3. Triage (Alert Validation)
**Goal**: Filter out noise and identify real threats.
*   **Action**: Analyst reviews the **Alerts Queue**.
    *   **False Positive**: Mark as `Closed`.
    *   **True Positive**: Click **Create Case** to promote it for investigation.

## 4. Investigate (Deep Analysis)
**Goal**: Understand the scope and root cause.
*   **Action**: Work inside the **Case Board**.
    *   **Timeline**: When did it start?
    *   **Observables**: Search **Threat Intel** for reputation of IP addresses or Hashes involved.
*   **Outcome**: Confirmed incident scope (e.g., "Host A is compromised by Malware X").

## 5. Respond (Containment)
**Goal**: Stop the bleeding.
*   **Action**: Execute **Playbooks** (Automation).
    *   *Example*: "Isolate Host" via CrowdStrike or "Block IP" on Firewall.
*   **Outcome**: Threat is contained, and the case can be marked as `Resolved`.
