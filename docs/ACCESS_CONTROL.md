# Role-Based Access Control (RBAC) & Permissions

zcrAI implements a granular, permission-based access control system. This decouples user **Roles** from specific **Functionalities**, allowing for flexible security policies that can be updated without code changes.

## Overview

- **Permissions**: Defined in `backend/api/core/access/access-control.ts`. They represent granular actions (e.g., `hunting.run_query`).
- **Roles**: Groups of permissions assigned to users (e.g., `soc_analyst`).
- **Middleware**: `withPermission(permission)` in `backend/api/middleware/auth.ts` enforces checks at the route level.

## Defined Roles & Permissions

Current configuration as of Dec 2024:

### 1. Superadmin
- **Access**: Full System Access.
- **Permissions**: `*` (Implicit all).
- **Use Case**: Platform owner, System configuration.

### 2. Tenant Admin (`tenant_admin`)
- **Access**: Full management within their specific Tenant Organization.
- **Permissions**:
  - `hunting.run_query`: Execute SQL/Sigma queries.
  - `hunting.view_results`: View investigation results.
  - `users.manage`: Create/Delete users and sessions.
  - `alerts.manage`: Change alert status/assignee.
  - `cases.manage`: Escalation and case closure.

### 3. SOC Analyst (`soc_analyst`)
- **Access**: Operational usage for investigations.
- **Permissions**:
  - `hunting.run_query`
  - `hunting.view_results`
  - `alerts.manage`
  - `cases.view` & `cases.manage`
- **Restrictions**: Cannot manage users or system settings.

### 4. Customer / Viewer (`customer`)
- **Access**: Read-only view for stakeholders.
- **Permissions**:
  - `cases.view`
  - `cases.manage` (Limited to commenting/approval inputs usually)
- **Restrictions**: NO Threat Hunting, NO User Management.

## Developer Guide

### Checking Permissions in Controllers

Use the `withPermission` middleware in your Elysia routes:

```typescript
import { withPermission } from '../middleware/auth';

app.post('/dangerous-action', handler, {
    beforeHandle: [withPermission('system.configure')]
});
```

### Checking Permissions in Business Logic

Use the helper function `hasRolePermission`:

```typescript
import { hasRolePermission } from '../core/access/access-control';

if (!hasRolePermission(user.role, 'hunting.run_query')) {
    throw new Error('Forbidden');
}
```

### Adding New Permissions

1. Edit `backend/api/core/access/access-control.ts`.
2. Add the new permission string to `Permission` type.
3. Add the permission to the appropriate roles in `ROLE_PERMISSIONS`.
