# Detect (Rules & Alerts)

**Pages**: 
*   `Settings > Detection Rules` (`/detection`)
*   `Alerts` (`/alerts`)

## Detection Rules
zcrAI uses **Sigma** rules to detect threats.
1.  Navigate to **Settings > Detection Rules**.
2.  You can view all active rules, their severity, and the data sources they monitor.
3.  Rules are automatically applied to incoming logs.

## Handling Alerts
When a detection rule matches a log, an **Alert** is generated.
1.  Navigate to the **Alerts** page.
2.  Review new alerts in real-time.
3.  **Grouping**: Alerts are automatically grouped into **Cases** based on shared entities (e.g., same IP address or Hostname) to reduce noise.
