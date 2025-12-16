# Log Viewer vs Alerts

One of the most common questions is: *"What is the difference between Logs and Alerts?"*

## At a Glance

| Feature | **Logs** (`/logs`) | **Alerts** (`/alerts`) |
| :--- | :--- | :--- |
| **Data Source** | Raw data from EDR, Firewall, Syslog. | Output of **Detection Rules** creating matches from logs. |
| **Volume** | High (Billions of records). | Low (Only suspicious items). |
| **Actionable?** | No. Passive record of events. | Yes. Requires Triage or Investigation. |
| **Use Case** | Forensic Hunting, Debugging. | Incident Response. |

---

## 1. Log Viewer (`/logs`)
**📍 Page Location**: `Log Viewer` (or `/logs`)

This page is your "Google for Security Data". It contains the raw telemetry.

### Key Features
*   **Query Bar**: Use Lucene-like syntax to filter data (e.g., `process_name: "powershell.exe" AND user: "admin"`).
*   **Time Picker**: Go back in time to see what happened *before* an alert triggered.
*   **Field Explorer**: See a breakdown of available fields (e.g., `dest_ip`, `event_id`).

### When to use it?
*   **Threat Hunting**: Looking for patterns that *didn't* trigger an alert.
*   **Forensics**: An alert told you "Host A is infected". You use the Log Viewer to see *everything else* Host A did in the last 24 hours.

---

## 2. Alerts (`/alerts`)
**📍 Page Location**: `Alerts`

This page is your **Inbox**. It contains only events that matched a specific Threat Logic (Sigma Rule).

### When to use it?
*   **Daily Triage**: Reviewing the queue of incoming potential threats.
*   **Response**: deciding whether to block an IP or ignore a False Positive.
