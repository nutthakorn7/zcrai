# Investigate (Cases)

Once an alert is promoted, it becomes a **Case**. This is where the deep analysis happens.

## 1. Manage Workload (Case Board)
**📍 Page Location**: `Case Board` (`/cases`)

The Case Board is your daily workspace. It uses a **Kanban** layout to track progress.

*   **Columns**:
    *   **Open**: New cases automatically landed here.
    *   **In Progress**: Drag cases here when you start working on them.
    *   **Resolved**: Drag here when finished.
*   **Actions**:
    *   **Assign**: Click the user icon on a card to assign it to yourself or a teammate.
    *   **Filter**: Use the top bar to filter by `Severity: Critical` or `Assignee: Me`.

---

## 2. Deep Dive (Case Details)
**📍 Page Location**: `Case Details` (`/cases/:id`)
*(Access by clicking any card on the Case Board)*

This page is divided into specialized tabs for investigation:

### A. Overview Tab (The Story)
*   **Case Description**: Auto-generated summary of the attack (e.g., "Multiple failed logins followed by successful access").
*   **Severity Score**: Dynamic score updated as new evidence is added.
*   **Participants**: See which analysts are collaborating on this case.

### B. Timeline Tab (The "When")
*   **Visual Graph**: A chronological chart of all events linked to this case.
*   **Action**: Use this to spot the "Patient Zero" or initial entry point.

### C. Observables Tab (The "What")
This is the most critical tab for IOCs (Indicators of Compromise).
*   **List**: Displays all IPs, Hashs (MD5/SHA256), Domains, and URLs found in the logs.
*   **Reputation Check**: 
    1.  Hover over any IP address (e.g., `192.168.1.5`).
    2.  Check the **VirusTotal Score** badge next to it.
    3.  **Action**: Click the "Search" icon to jump to the **Threat Intel Page** for a full report.

---

## 3. Threat Intelligence Lookup
**📍 Page Location**: `Threat Intel` (`/threat-intel`)

If you find a suspicious indicator (e.g., an unfamiliar external IP) in a case:
1.  Copy the indicator.
2.  Go to **Threat Intel** page.
3.  Paste into the **Global Search Bar**.
4.  **Result**: You will see a dossier including:
    *   **Reputation Score** (0-100 Malicious confidence).
    *   **ASN / Geo-IP**: Where the IP is hosted.
    *   **Related Campaigns**: Known malware families associated with this IP.

