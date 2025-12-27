/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * Defines the mapping between user roles and specific permissions.
 * This decouples the code from roles, allowing for future flexibility.
 */

// Permission type for RBAC
export const PERMISSIONS = [
  'hunting.run_query',
  'hunting.view_results',
  'users.manage',
  'system.configure',
  'alerts.manage',
  'alerts.view_results',
  'cases.view',
  'cases.manage'
] as const;

export type Permission = typeof PERMISSIONS[number];

// Role Permissions Mapping
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // Superadmin has implicit all permissions
  'superadmin': [], 
  
  'tenant_admin': [
    'hunting.run_query',
    'hunting.view_results',
    'users.manage',
    'alerts.manage',
    'alerts.view_results',
    'cases.view',
    'cases.manage'
  ],
  
  'admin': [ // Alias for tenant_admin if used
    'hunting.run_query',
    'hunting.view_results',
    'users.manage',
    'alerts.manage',
    'alerts.view_results',
    'cases.view',
    'cases.manage'
  ],
  
  'soc_analyst': [
    'hunting.run_query',
    'hunting.view_results',
    'alerts.manage',
    'alerts.view_results',
    'cases.view',
    'cases.manage'
  ],
  
  'analyst': [ // Alias for soc_analyst if used
    'hunting.run_query',
    'hunting.view_results',
    'alerts.manage',
    'alerts.view_results',
    'cases.view',
    'cases.manage'
  ],
  
  'customer': [
    'cases.view',
    'cases.manage'
  ],
  
  'user': []
};

/**
 * Check if a role has a specific permission
 */
export const hasRolePermission = (role: string, permission: Permission): boolean => {
  if (role === 'superadmin') return true;
  // Fallback for typo-ed roles or undefined roles
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
};
