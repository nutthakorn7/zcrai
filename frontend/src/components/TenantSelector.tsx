import { Select, SelectItem, Button, Chip } from "@heroui/react"
import { useAdmin } from "../contexts/AdminContext"

export default function TenantSelector() {
  const { isSuperAdmin, tenants, selectedTenantId, selectedTenant, selectTenant, clearSelection, loading } = useAdmin()

  if (!isSuperAdmin) return null

  return (
    <div className="flex items-center gap-2">
      {selectedTenant ? (
        <>
          <Chip color="warning" variant="flat" size="sm">
            Viewing: {selectedTenant.name}
          </Chip>
          <Button 
            size="sm" 
            variant="flat" 
            color="danger"
            onPress={clearSelection}
          >
            Exit
          </Button>
        </>
      ) : (
        <Select
          size="sm"
          placeholder="Select Tenant"
          className="w-48"
          isLoading={loading}
          selectedKeys={selectedTenantId ? [selectedTenantId] : []}
          onSelectionChange={(keys) => {
            const id = Array.from(keys)[0] as string
            if (id) selectTenant(id)
          }}
        >
          {tenants.map(tenant => (
            <SelectItem key={tenant.id} textValue={tenant.name}>
              <div className="flex flex-col">
                <span className="text-sm">{tenant.name}</span>
                <span className="text-xs text-default-400">
                  {tenant.eventCount.toLocaleString()} events
                </span>
              </div>
            </SelectItem>
          ))}
        </Select>
      )}
    </div>
  )
}
