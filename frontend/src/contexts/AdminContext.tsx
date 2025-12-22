import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../shared/api/api'

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
  // Initialize from localStorage to persist across reloads
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_selected_tenant_id')
    }
    return null
  })
  const [loading, setLoading] = useState(false)

  const isSuperAdmin = userRole === 'superadmin'

  // Load tenants on mount if superadmin
  useEffect(() => {
    if (isSuperAdmin) {
      refreshTenants()
    }
  }, [isSuperAdmin])

  const refreshTenants = async () => {
    if (!isSuperAdmin) return
    setLoading(true)
    try {
      const res = await api.get('/admin/tenants')
      setTenants(res.data)
    } catch (e) {
      console.error('Failed to load tenants:', e)
    } finally {
      setLoading(false)
    }
  }

  const selectTenant = async (tenantId: string) => {
    try {
      await api.post(`/admin/impersonate/${tenantId}`)
      setSelectedTenantId(tenantId)
      localStorage.setItem('admin_selected_tenant_id', tenantId)
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
      localStorage.removeItem('admin_selected_tenant_id')
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
