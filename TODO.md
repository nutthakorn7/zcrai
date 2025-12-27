# zcrAI TODO

## Frontend - UI Refactoring (Low Priority)

### ConfirmDialog Integration
Replace remaining `confirm()` calls with `ConfirmDialog` component:

- [x] `ReportsPage.tsx` - delete schedule confirmation
- [x] `ProfilePage.tsx` - revoke session confirmation  
- [x] `RetentionSettingsPage.tsx` - cleanup data confirmation
- [x] `SubscriptionPage.tsx` - switch plan confirmation
- [x] `TenantPage.tsx` - suspend tenant confirmation
- [x] `PlaybookEditor.tsx` - delete step confirmation (2 occurrences)

**Reference:** See completed examples in:
- `frontend/src/pages/settings/IntegrationPage.tsx`
- `frontend/src/pages/observables/ObservablesPage.tsx`
- `frontend/src/pages/playbooks/PlaybooksPage.tsx`

---

## Completed ✅
- [x] Created reusable components: `PageHeader`, `ConfirmDialog`, `CrudModal`, `FilterToolbar`
- [x] Refactored 6 pages with `PageHeader`
- [x] Refactored 5 pages with `ConfirmDialog`
