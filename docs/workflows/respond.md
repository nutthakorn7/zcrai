# Respond (Playbooks)

**📍 Page Location**: `Automation > Playbooks` (`/playbooks`)

The final phase of the SOC lifecycle is neutralizing the threat.

## 1. Playbook Library
This page lists all available automated response capabilities.
*   **Card View**: Each playbook is represented by a card (e.g., "Block IP", "Isolate Host").
*   **Toggle Automation**:
    *   **Manual Mode** (Default): Analyst must check a box to approve the action.
    *   **Automatic Mode**: Switch the toggle to `ON` to let the system run this playbook instantly when a rule matches.

## 2. Executing a Response
**📍 Location**: Inside a **Case Details** page (`/cases/:id`)

You don't need to leave the case to respond.
1.  Go to the **Overview Tab** of the case.
2.  Look for the **"Recommended Actions"** widget.
3.  **Click Run**: Select a playbook (e.g., *CrowdStrike Network Containment*).
4.  **Confirm**: A modal will ask for confirmation.
5.  **Verify**: Check the **Timeline Tab** to see the system log: *"Host host-01 successfully isolated via CrowdStrike API"*.

## 3. Approval Workflows (For Enterprise)
**📍 Page Location**: `Approvals` (`/approvals`)

For high-impact actions (like shutting down a production server), the system may require a manager's approval.
1.  Analyst clicks "Run Playbook".
2.  System sets status to `Pending Approval`.
3.  Manager goes to `/approvals` and clicks **Approve**.
4.  Playbook executes.

