# ADR: System User & Integration Resilience

## Context
We encountered two critical issues in production:
1.  **Hardcoded Credentials**: Code improperly relied on `process.env` for integration tokens (legacy Single-Tenant pattern), causing failure when users added integrations via UI (Database).
2.  **Notification Crashes**: System-level events (e.g., "Integration Down") attempted to use `userId: 'system'`, which violated the UUID schema constraint of the `users` table, causing backend crashes.

## Decisions

### 1. Dynamic Configuration Priority
**Rule:** All Integration Services (`EDRActionService`, `TicketingService`, etc.) MUST fetch configuration from the Database (`api_keys` table) using the `tenantId`.
**Fallback:** Environment variables (`process.env`) should ONLY be used as a fallback for the "Default System Tenant" if no DB config is found, and must be explicitly documented.
**Implementation:** Updated `SentinelOneActions` to accept a `config` object.

### 2. "System Bot" User Identity
**Problem:** The system needs to perform actions (Audit Logs, Notifications) that don't belong to a human user.
**Solution:** We have implemented a `seedSystemUser()` function that runs on backend startup.
-   **Email:** `system@zcr.ai`
-   **Role:** `superadmin`
-   **Name:** System Bot
**Usage:** When the system triggers an event (e.g., automated remediation, health check alert), it SHOULD use the UUID of this System Bot if a specific human actor is not available.
**Alternative:** For notifications meant for admins, explicitly query the Admin Users (as fixed in `IntegrationService`) rather than sending to "system".

### 3. Integration Health Checks
**Rule:** Health checks must capture errors gracefully and NEVER crash the main scheduler loop.
**Fix:** `IntegrationService.checkAllHealth` now catches errors and routes alerts to valid Admin UUIDs.

## Status
-   [x] Implemented `seedSystemUser` in `backend/api/index.ts`
-   [x] Refactored `IntegrationService` notifications
-   [x] Updated `EDRActionService` logic
