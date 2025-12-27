# Detect (Rules & Alerts)

This workflow covers how threats are identified and how you triage the initial signals.

## 1. Configure Detection Rules
**📍 Page Location**: `Settings > Detection Rules` (`/detection`)

Before anything is detected, you need active rules.
*   **Sigma Rules Table**: This list displays all actively running detection logic.
    *   **Rule Name**: e.g., "Suspicious PowerShell Execution".
    *   **Severity**: Critical measures impact.
    *   **Status**: Toggle switch (Active/Inactive).
*   **Action**: Use the **Search Bar** to find specific CVEs or attack techniques (e.g., "Log4j").

---

## 2. Review Incoming Alerts
**📍 Page Location**: `Alerts` (`/alerts`)

When a rule finds a match, an Alert is born. This page is your **Triage Queue**.

### The Alert Queue UI
*   **Live Stream**: New alerts appear at the top.
*   **Status Badges**:
    *   `New` 🔴: Untouched. Needs review.
    *   `Acknowledged` 🟡: Analyst is looking at it.
    *   `Closed` 🟢: False Positive or handled.

### Triage Process (Step-by-Step)
1.  **Select an Alert**: Click on any row in the table.
2.  **Quick View Drawer**: A side panel opens on the right.
3.  **Review Evidence**: Check the `Source IP`, `User`, and `Process Name`.
4.  **Promote to Case**: If it looks real, click the **"Create Case"** button. This moves the alert into the **Investigate** workflow.

