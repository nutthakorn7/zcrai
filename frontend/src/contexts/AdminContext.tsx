import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { api } from '../shared/api';

interface Tenant {
  id: string
  name: string
  status: string
  userCount: number
  integrationCount: number
  eventCount: number
  createdAt: string
}

interface AdminContextType {
  isSuperAdmin: boolean
  tenants: Tenant[]
  selectedTenantId: string | null
  selectedTenant: Tenant | null
  loading: boolean
  selectTenant: (tenantId: string) => Promise<void>
  clearSelection: () => Promise<void>
  refreshTenants: () => Promise<void>
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children, userRole }: { children: ReactNode; userRole: string }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSuperAdmin = userRole === 'superadmin'

  const refreshTenants = useCallback(async () => {
    if (!isSuperAdmin) return
    setLoading(true)
    try {
      const { api } = await import('../shared/api');
      const res = await api.get('/admin/tenants')
      setTenants(res.data)
    } catch (e) {
      console.error('Failed to load tenants:', e)
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin])

  // Load tenants on mount if superadmin
  useEffect(() => {
    if (isSuperAdmin) {
      refreshTenants()
    }
  }, [isSuperAdmin, refreshTenants])

  const selectTenant = async (tenantId: string) => {
    try {
      await api.post(`/admin/impersonate/${tenantId}`)
      setSelectedTenantId(tenantId)
      // Reload page to refresh data
      window.location.reload()
    } catch (e) {
      console.error('Failed to select tenant:', e)
    }
  }

  const clearSelection = async () => {
    try {
      await api.post('/admin/impersonate/clear')
      setSelectedTenantId(null)
      window.location.reload()
    } catch (e) {
      console.error('Failed to clear selection:', e)
    }
  }

  const selectedTenant = tenants.find(t => t.id === selectedTenantId) || null

  return (
    <AdminContext.Provider value={{
      isSuperAdmin,
      tenants,
      selectedTenantId,
      selectedTenant,
      loading,
      selectTenant,
      clearSelection,
      refreshTenants,
    }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}
