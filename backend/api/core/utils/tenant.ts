/**
 * Tenant Utilities
 */

// Default system tenant ID for superadmin view (main demo tenant with data)
export const DEFAULT_DEMO_TENANT_ID = '03c703a2-6731-4306-9a39-e68070415069';

/**
 * Get effective tenantId supporting superadmin impersonation
 * @param user User object from auth middleware
 * @param selectedTenant selected_tenant cookie value
 * @returns effective tenantId string
 */
export const getEffectiveTenantId = (user: any, selectedTenant: { value?: unknown } | undefined): string => {
  if (user.role === 'superadmin') {
    if (selectedTenant?.value) {
      return String(selectedTenant.value)
    }
    // Fallback to system tenant ID for superadmin view (main demo tenant with data)
    return DEFAULT_DEMO_TENANT_ID
  }
  
  if (!user.tenantId) {
    throw new Error('No tenant selected. Super Admin must select a tenant first.')
  }
  return user.tenantId as string
}
