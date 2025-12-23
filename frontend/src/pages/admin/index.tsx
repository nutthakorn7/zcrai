import { useEffect, useState } from "react"
import { 
  Card, CardBody, Button, Spinner, Chip,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure
} from "@heroui/react"
import { useNavigate } from "react-router-dom"
import { api } from "../../shared/api/api"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Tenant {
  id: string
  name: string
  status: string
  userCount: number
  integrationCount: number
  eventCount: number
  createdAt: string
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
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [search, setSearch] = useState("")
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantUsers, setTenantUsers] = useState<User[]>([])
  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [tenantsRes, summaryRes, healthRes] = await Promise.all([
          api.get('/admin/tenants'),
          api.get('/admin/summary'),
          api.get('/admin/health')
        ])
        setTenants(tenantsRes.data)
        setSummary(summaryRes.data)
        setHealth(healthRes.data)
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
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          <p className="text-default-500">System-wide overview and tenant management</p>
        </div>
        {health && (
          <div className="flex gap-3">
            <Chip color={health.database === 'connected' ? 'success' : 'danger'} variant="flat" size="sm">DB: {health.database}</Chip>
            <Chip color={health.clickhouse === 'connected' ? 'success' : 'danger'} variant="flat" size="sm">CH: {health.clickhouse}</Chip>
            <Chip color={health.redis === 'connected' ? 'success' : 'danger'} variant="flat" size="sm">Redis: {health.redis}</Chip>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-content1">
          <CardBody className="text-center">
            <p className="text-4xl font-bold text-primary">{summary?.tenants || 0}</p>
            <p className="text-default-500">Total Tenants</p>
          </CardBody>
        </Card>
        <Card className="bg-content1">
          <CardBody className="text-center">
            <p className="text-4xl font-bold text-secondary">{summary?.users || 0}</p>
            <p className="text-default-500">Total Users</p>
          </CardBody>
        </Card>
        <Card className="bg-content1">
          <CardBody className="text-center">
            <p className="text-4xl font-bold text-success">{summary?.integrations || 0}</p>
            <p className="text-default-500">Integrations</p>
          </CardBody>
        </Card>
        <Card className="bg-content1">
          <CardBody className="text-center">
            <p className="text-4xl font-bold text-warning">{(summary?.events || 0).toLocaleString()}</p>
            <p className="text-default-500">Total Events</p>
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
              <TableColumn>TENANT NAME</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>USERS</TableColumn>
              <TableColumn>INTEGRATIONS</TableColumn>
              <TableColumn>EVENTS</TableColumn>
              <TableColumn>CREATED</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
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
                      <p className="text-sm text-default-500">Tenant ID</p>
                      <p className="font-mono text-xs">{selectedTenant.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-default-500">Status</p>
                      <Chip 
                        size="sm" 
                        color={selectedTenant.status === 'active' ? 'success' : 'danger'}
                      >
                        {selectedTenant.status}
                      </Chip>
                    </div>
                    <div>
                      <p className="text-sm text-default-500">Users</p>
                      <p className="text-2xl font-bold">{selectedTenant.userCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-default-500">Integrations</p>
                      <p className="text-2xl font-bold">{selectedTenant.integrationCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-default-500">Total Events</p>
                      <p className="text-2xl font-bold">{selectedTenant.eventCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-default-500">Created</p>
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
                    <p className="text-default-500 text-sm">No usage data available</p>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Close</Button>
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
    </div>
  )
}
