import { Outlet, NavLink } from "react-router-dom";
import { Card, CardBody } from "@heroui/react";
import { useAuth } from "../shared/store/useAuth";

export default function SettingsLayout() {
  const { user } = useAuth();
  const isTenantAdmin = user?.role === 'tenant_admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <div className="flex min-h-screen bg-background text-foreground p-8 gap-6">
      {/* Sidebar */}
      <Card className="w-64 h-fit">
        <CardBody className="p-4">
          <h2 className="text-lg font-bold mb-4 px-2">Settings</h2>
          <nav className="flex flex-col gap-2">
            <NavLink 
              to="/settings/profile"
              className={({ isActive }) => 
                `px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'hover:bg-default-100'}`
              }
            >
              My Profile
            </NavLink>
            
            <NavLink 
              to="/settings/mfa"
              className={({ isActive }) => 
                `px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'hover:bg-default-100'}`
              }
            >
              Security (MFA)
            </NavLink>

            {isTenantAdmin && (
              <>
                <div className="my-2 border-t border-default-200" />
                <p className="text-xs text-default-500 px-2 mb-1">Organization</p>
                
                <NavLink 
                  to="/settings/users"
                  className={({ isActive }) => 
                    `px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'hover:bg-default-100'}`
                  }
                >
                  User Management
                </NavLink>

                <NavLink 
                  to="/settings/integrations"
                  className={({ isActive }) => 
                    `px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'hover:bg-default-100'}`
                  }
                >
                  Integrations
                </NavLink>

                <NavLink 
                  to="/settings/notifications"
                  className={({ isActive }) => 
                    `px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'hover:bg-default-100'}`
                  }
                >
                  Notifications
                </NavLink>
              </>
            )}

            {isSuperAdmin && (
              <>
                <div className="my-2 border-t border-default-200" />
                <p className="text-xs text-default-500 px-2 mb-1">Platform</p>
                
                <NavLink 
                  to="/settings/tenants"
                  className={({ isActive }) => 
                    `px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'hover:bg-default-100'}`
                  }
                >
                  Tenant Management
                </NavLink>
              </>
            )}
          </nav>
        </CardBody>
      </Card>

      {/* Main Content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
