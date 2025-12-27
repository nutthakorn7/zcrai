import { useEffect, useState } from "react"
import { 
  Card, CardBody, Button, Spinner, Chip,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure
} from "@heroui/react"
import { useNavigate } from "react-router-dom"
import { api } from "@/shared/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Tenant {
  id: string
  name: string
  status: string
  userCount: number
  integrationCount: number
  eventCount: number
  createdAt: string
  // Quotas (optional as they may not be in list view but are in details)
  maxUsers?: number
  maxEvents?: number
  maxStorage?: number
}

interface SystemSummary {
  tenants: number
  users: number
  integrations: number
  events: number
}

interface HealthStatus {
  database: string
  clickhouse: string
  redis: string
  status: string
  collector?: string
}

interface User {
  id: string
  email: string
  role: string
  status: string
}

interface UsageData {
  date: string
  count: number
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [licenseData, setLicenseData] = useState<any>(null)
  const isLicenseModalOpen = useDisclosure()
  const [licenseKey, setLicenseKey] = useState('')
  const [updatingLicense, setUpdatingLicense] = useState(false)

  // Tenant Data State
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [search, setSearch] = useState('')
  
  // Tenant Details Modal
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantUsers, setTenantUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usageData, setUsageData] = useState<UsageData[]>([])

  // Quota Editing
  const { isOpen: isQuotaOpen, onOpen: onQuotaOpen, onOpenChange: onQuotaOpenChange } = useDisclosure()
  const [quotas, setQuotas] = useState({ maxUsers: 0, maxEvents: 0, maxStorage: 0 })
  const [isUpdatingQuota, setIsUpdatingQuota] = useState(false)

  const handleUpdateQuota = async (onClose: () => void) => {
    if (!selectedTenant) return
    setIsUpdatingQuota(true)
    try {
        await api.put(`/admin/tenants/${selectedTenant.id}`, quotas)
        // Refresh tenants list to see changes
        const res = await api.get('/admin/tenants')
        setTenants(res.data)
        // Also update selected tenant so UI refreshes immediately if needed
        setSelectedTenant(prev => prev ? ({ ...prev, ...quotas }) : null)
        onClose()
    } catch (e) {
        console.error('Failed to update quotas', e)
        alert('Failed to update quotas')
    } finally {
        setIsUpdatingQuota(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [tenantsRes, summaryRes, healthRes, licenseRes] = await Promise.all([
          api.get('/admin/tenants'),
          api.get('/admin/summary'),
          api.get('/admin/health'),
          api.get('/admin/license').catch(() => ({ data: { data: null } }))
        ])
        setTenants(tenantsRes.data)
        setSummary(summaryRes.data)
        setHealth(healthRes.data)
        setLicenseData(licenseRes.data.data)
      } catch (e: any) {
        if (e.response?.status === 403) {
          navigate('/dashboard')
        }
        console.error('Failed to load admin data:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [navigate])

  const handleUpdateLicense = async () => {
    if (!licenseKey) return
    setUpdatingLicense(true)
    try {
      await api.post('/admin/license', { key: licenseKey })
      // Refresh license data
      const res = await api.get('/admin/license')
      setLicenseData(res.data.data)
      isLicenseModalOpen.onClose()
      setLicenseKey('')
    } catch (e) {
      console.error('Failed to update license', e)
    } finally {
      setUpdatingLicense(false)
    }
  }

  const handleViewTenant = async (tenant: Tenant) => {
    try {
      await api.post(`/admin/impersonate/${tenant.id}`)
      navigate('/dashboard')
      window.location.reload()
    } catch (e) {
      console.error('Failed to impersonate tenant:', e)
    }
  }

  const handleOpenDetails = async (tenant: Tenant) => {
    setSelectedTenant(tenant)
    onOpen()
    setLoadingUsers(true)
    try {
      const [usersRes, usageRes] = await Promise.all([
        api.get(`/admin/tenants/${tenant.id}/users`),
        api.get(`/admin/tenants/${tenant.id}/usage?days=30`)
      ])
      setTenantUsers(usersRes.data)
      setUsageData(usageRes.data)
    } catch (e) {
      console.error('Failed to load tenant details:', e)
    } finally {
      setLoadingUsers(false)
    }
  }

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen dark bg-background text-foreground">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Super Admin Dashboard</h1>
          <p className="text-foreground/60 text-sm mt-1">System-wide overview and tenant management</p>
        </div>
        <div className="flex items-center gap-4">
          {health && (
            <div className="flex gap-3">
              <Chip color={health.database === 'connected' ? 'success' : 'danger'} variant="flat" size="sm">DB: {health.database}</Chip>
              <Chip color={health.clickhouse === 'connected' ? 'success' : 'danger'} variant="flat" size="sm">CH: {health.clickhouse}</Chip>
              <Chip color={health.redis === 'connected' ? 'success' : 'danger'} variant="flat" size="sm">Redis: {health.redis}</Chip>
              {health.collector && (
                <Chip 
                  color={health.collector === 'connected' ? 'success' : health.collector === 'standby' ? 'warning' : 'danger'} 
                  variant="flat" 
                  size="sm"
                >
                  Collector: {health.collector}
                </Chip>
              )}
            </div>
          )}
          <Button 
            color="primary" 
            variant="flat" 
            size="sm"
            onPress={isLicenseModalOpen.onOpen}
          >
            Manage License
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
          <CardBody className="text-center p-6">
            <p className="text-4xl font-bold font-display text-primary tracking-tight">{summary?.tenants || 0}</p>
            <p className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] mt-2">Total Tenants</p>
          </CardBody>
        </Card>
        <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
          <CardBody className="text-center p-6">
            <p className="text-4xl font-bold font-display text-secondary tracking-tight">{summary?.users || 0}</p>
            <p className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] mt-2">Total Users</p>
          </CardBody>
        </Card>
        <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
          <CardBody className="text-center p-6">
            <p className="text-4xl font-bold font-display text-success tracking-tight">{summary?.integrations || 0}</p>
            <p className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] mt-2">Integrations</p>
          </CardBody>
        </Card>
        <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
          <CardBody className="text-center p-6">
            <p className="text-4xl font-bold font-display text-warning tracking-tight">{(summary?.events || 0).toLocaleString()}</p>
            <p className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] mt-2">Total Events</p>
          </CardBody>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card className="bg-content1">
        <CardBody>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">All Tenants</h2>
            <Input
              placeholder="Search tenants..."
              value={search}
              onValueChange={setSearch}
              className="w-64"
              size="sm"
            />
          </div>

          <Table aria-label="Tenants table">
            <TableHeader>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">TENANT NAME</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">STATUS</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">USERS</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">INTEGRATIONS</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">EVENTS</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">CREATED</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No tenants found">
              {filteredTenants.map(tenant => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <span className="font-medium">{tenant.name}</span>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      size="sm" 
                      color={tenant.status === 'active' ? 'success' : 'danger'}
                      variant="flat"
                    >
                      {tenant.status}
                    </Chip>
                  </TableCell>
                  <TableCell>{tenant.userCount}</TableCell>
                  <TableCell>{tenant.integrationCount}</TableCell>
                  <TableCell>{tenant.eventCount.toLocaleString()}</TableCell>
                  <TableCell>
                    {new Date(tenant.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="flat" 
                        color="primary"
                        onPress={() => handleViewTenant(tenant)}
                      >
                        View As
                      </Button>
                      <Button 
                        size="sm" 
                        variant="flat"
                        onPress={() => handleOpenDetails(tenant)}
                      >
                        Details
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Tenant Details Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                Tenant Details: {selectedTenant?.name}
              </ModalHeader>
              <ModalBody>
                {selectedTenant && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-foreground/50">Tenant ID</p>
                      <p className="font-mono text-xs">{selectedTenant.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-foreground/50">Status</p>
                      <Chip 
                        size="sm" 
                        color={selectedTenant.status === 'active' ? 'success' : 'danger'}
                      >
                        {selectedTenant.status}
                      </Chip>
                    </div>
                    <div>
                      <p className="text-sm text-foreground/50">Users</p>
                      <p className="text-2xl font-bold">{selectedTenant.userCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-foreground/50">Integrations</p>
                      <p className="text-2xl font-bold">{selectedTenant.integrationCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-foreground/50">Total Events</p>
                      <p className="text-2xl font-bold">{selectedTenant.eventCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-foreground/50">Created</p>
                      <p>{new Date(selectedTenant.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {/* Users List */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Tenant Users</h3>
                  {loadingUsers ? (
                    <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                  ) : (
                    <Table aria-label="Tenant users" removeWrapper isCompact>
                      <TableHeader>
                        <TableColumn>EMAIL</TableColumn>
                        <TableColumn>ROLE</TableColumn>
                        <TableColumn>STATUS</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="No users found">
                        {tenantUsers.map(user => (
                          <TableRow key={user.id}>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Chip size="sm" variant="flat" color={user.role === 'tenant_admin' ? 'secondary' : 'default'}>
                                {user.role}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <Chip size="sm" color={user.status === 'active' ? 'success' : 'danger'} variant="dot">
                                {user.status}
                              </Chip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Usage Chart */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Events (Last 30 Days)</h3>
                  {usageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={usageData}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10, fill: '#a1a1aa' }} 
                          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                          tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'rgba(255, 255, 255, 0.4)' }} 
                          axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                          tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                        />
                        <Tooltip 
                          labelFormatter={(v) => new Date(v).toLocaleDateString()}
                          formatter={(value: number) => [value.toLocaleString(), 'Events']}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--heroui-content1))', 
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px',
                            color: 'hsl(var(--heroui-foreground))'
                          }}
                          labelStyle={{ color: 'hsl(var(--heroui-foreground) / 0.5)' }}
                        />
                        <Bar dataKey="count" fill="rgb(139, 92, 246)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-foreground/50 text-sm">No usage data available</p>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Close</Button>
                <Button 
                    color="warning" 
                    variant="flat"
                    onPress={() => {
                        setQuotas({
                            maxUsers: selectedTenant?.maxUsers || 5, // Default or fetch real
                            maxEvents: selectedTenant?.maxEvents || 10000,
                            maxStorage: selectedTenant?.maxStorage || 1
                        })
                        onQuotaOpen()
                    }}
                >
                    Edit Quotas
                </Button>
                <Button 
                  color="primary" 
                  onPress={() => {
                    if (selectedTenant) handleViewTenant(selectedTenant)
                  }}
                >
                  View As This Tenant
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Edit Quota Modal */}
      <Modal isOpen={isQuotaOpen} onOpenChange={onQuotaOpenChange}>
          <ModalContent>
              {(onClose) => (
                  <>
                      <ModalHeader>Update Tenant Quotas</ModalHeader>
                      <ModalBody>
                        <p className="text-sm text-foreground/60 mb-4">
                            Adjust limits for <span className="font-bold text-foreground">{selectedTenant?.name}</span>.
                        </p>
                        <Input 
                            label="Max Users" 
                            type="number" 
                            value={String(quotas.maxUsers)} 
                            onValueChange={(v) => setQuotas(prev => ({ ...prev, maxUsers: parseInt(v) || 0 }))}
                        />
                        <Input 
                            label="Max Events (per month)" 
                            type="number" 
                            value={String(quotas.maxEvents)} 
                            onValueChange={(v) => setQuotas(prev => ({ ...prev, maxEvents: parseInt(v) || 0 }))}
                        />
                        <Input 
                            label="Max Storage (GB)" 
                            type="number" 
                            value={String(quotas.maxStorage)} 
                            onValueChange={(v) => setQuotas(prev => ({ ...prev, maxStorage: parseInt(v) || 0 }))}
                        />
                      </ModalBody>
                      <ModalFooter>
                          <Button variant="light" onPress={onClose}>Cancel</Button>
                          <Button color="primary" onPress={() => handleUpdateQuota(onClose)} isLoading={isUpdatingQuota}>
                              Save Quotas
                          </Button>
                      </ModalFooter>
                  </>
              )}
          </ModalContent>
      </Modal>

      {/* License Modal */}
      <Modal isOpen={isLicenseModalOpen.isOpen} onOpenChange={isLicenseModalOpen.onOpenChange} size="md">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                Enterprise License Management
              </ModalHeader>
              <ModalBody>
                {licenseData ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-primary">{licenseData.plan} Edition</span>
                        <Chip size="sm" color="success" variant="flat">Active</Chip>
                      </div>
                      <p className="text-xs text-foreground/60 mt-1">Version {licenseData.version}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-content2 rounded-lg">
                        <p className="text-xs text-foreground/50">Max Tenants</p>
                        <p className="text-lg font-bold">{licenseData.maxTenants}</p>
                      </div>
                      <div className="p-3 bg-content2 rounded-lg">
                        <p className="text-xs text-foreground/50">Max Users</p>
                        <p className="text-lg font-bold">{licenseData.maxUsers}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-1">Expires At</p>
                      <p className="text-sm text-foreground/70">
                        {new Date(licenseData.expiresAt).toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>

                    <div className="border-t border-white/10 pt-4 mt-2">
                        <p className="text-sm font-medium mb-2">Update License Key</p>
                        <textarea
                            className="w-full bg-content2 rounded-lg p-3 text-xs font-mono border border-white/5 focus:outline-none focus:border-primary/50 text-foreground/80 h-24 resize-none"
                            placeholder="Paste new license key here..."
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                        />
                    </div>
                  </div>
                ) : (
                  <div className="py-8 flex justify-center">
                    <Spinner />
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Close</Button>
                <Button 
                  color="primary" 
                  isDisabled={!licenseKey || updatingLicense}
                  isLoading={updatingLicense}
                  onPress={handleUpdateLicense}
                >
                  Update License
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
