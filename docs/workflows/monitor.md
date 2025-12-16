# Monitor (Dashboard)

**📍 Page Location**: `Dashboard` (Root `/`)
**🎯 Goal**: Real-time situational awareness of the security posture.

## 1. Top Metrics Bar (KPIs)
The top row of the dashboard gives you an instant health check.

*   **Total Active Cases** `( Metric Card )`
    *   **What it means**: The number of security incidents currently in `Open` or `In Progress` status.
    *   **Action**: If this number spikes, click on it to jump directly to the **Case Board** (`/cases`).
*   **Mean Time to Respond (MTTR)** `( Metric Card )`
    *   **What it means**: The average time (in minutes) from "Alert Created" to "Case Resolved".
    *   **Target**: Aim for < 60 minutes. High MTTR implies bottlenecks in the **Investigate** phase.
*   **Events per Second (EPS)** `( Line Chart )`
    *   **What it means**: The volume of logs being ingested by the Collectors.
    *   **Action**: A sudden drop (to 0) indicates a **Collector Failure**. Check the **System Health** page (`/settings/system`).

## 2. Threat Coverage Map
**Component**: `MITRE ATT&CK Matrix`
*   **Mapping**: This heatmap maps your triggered alerts to the MITRE framework.
*   **Red Cells**: Tactics seen in the last 24 hours.
*   **Action**: Hover over a red cell (e.g., *Credential Access*) to see which specific detection rule triggered it.

## 3. Severity Distribution
**Component**: `Donut Chart`
*   **Visual**: Breakdown of alerts by Severity (Critical, High, Medium, Low).
*   **Drill-down**: Click on the "Critical" slice to navigate to the **Alerts Page** (`/alerts`) filtered by `Severity: Critical`.

