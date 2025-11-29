import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, AlertTriangle, FileText, Settings, 
  Shield, Users, LogOut
} from 'lucide-react';
import { useAuth } from '../shared/store/useAuth';

// SOC/XDR Dark Theme Colors
const COLORS = {
  bgSidebar: '#14151E',
  iconDefault: '#6B7082',
  iconHover: '#FFFFFF',
  iconActive: '#FFFFFF',
  bgHover: 'rgba(255,255,255,0.07)',
  bgActive: 'rgba(255,255,255,0.06)',
  accentPink: '#FF6B9C',
};

interface NavItem {
  icon: JSX.Element;
  label: string;
  path: string;
  adminOnly?: boolean;
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems: NavItem[] = [
    { 
      icon: <LayoutDashboard className="w-5 h-5" />, 
      label: 'Dashboard', 
      path: '/dashboard' 
    },
    { 
      icon: <AlertTriangle className="w-5 h-5" />, 
      label: 'Alerts', 
      path: '/alerts' 
    },
    { 
      icon: <FileText className="w-5 h-5" />, 
      label: 'Logs', 
      path: '/logs' 
    },
    { 
      icon: <Settings className="w-5 h-5" />, 
      label: 'Settings', 
      path: '/settings' 
    },
    { 
      icon: <Users className="w-5 h-5" />, 
      label: 'Admin', 
      path: '/admin',
      adminOnly: true 
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/') return true;
    return location.pathname.startsWith(path);
  };

  return (
    <div 
      className="fixed left-0 top-0 h-screen w-[70px] flex flex-col items-center py-4 z-50"
      style={{ backgroundColor: COLORS.bgSidebar }}
    >
      {/* Logo */}
      <div 
        className="mb-8 p-2 rounded-xl cursor-pointer"
        style={{ backgroundColor: 'rgba(255,107,156,0.15)' }}
        onClick={() => navigate('/dashboard')}
      >
        <Shield className="w-6 h-6" style={{ color: COLORS.accentPink }} />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          // ซ่อน Admin menu ถ้าไม่ใช่ superadmin
          if (item.adminOnly && user?.role !== 'superadmin') return null;
          
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative p-3 rounded-xl transition-all duration-200 group"
              style={{ 
                backgroundColor: active ? COLORS.bgActive : 'transparent',
              }}
              title={item.label}
            >
              {/* Active Indicator */}
              {active && (
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                  style={{ backgroundColor: COLORS.accentPink }}
                />
              )}
              
              {/* Icon */}
              <div 
                className="transition-colors duration-200"
                style={{ 
                  color: active ? COLORS.iconActive : COLORS.iconDefault 
                }}
              >
                {item.icon}
              </div>

              {/* Tooltip */}
              <div 
                className="absolute left-full ml-3 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
                style={{ 
                  backgroundColor: '#1A1C24',
                  color: '#E4E6EB',
                  border: '1px solid rgba(255,255,255,0.07)'
                }}
              >
                {item.label}
              </div>

              {/* Hover Background */}
              <style>{`
                button:hover {
                  background-color: ${COLORS.bgHover} !important;
                }
                button:hover div:first-of-type:not(.absolute) {
                  color: ${COLORS.iconHover} !important;
                }
              `}</style>
            </button>
          );
        })}
      </nav>

      {/* Bottom: Logout */}
      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={handleLogout}
          className="p-3 rounded-xl transition-all duration-200 hover:bg-white/5"
          title="Logout"
        >
          <LogOut className="w-5 h-5" style={{ color: COLORS.iconDefault }} />
        </button>
      </div>
    </div>
  );
}

// Layout Wrapper with Sidebar
export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0E0F14' }}>
      <Sidebar />
      <main className="flex-1 ml-[70px]">
        {children}
      </main>
    </div>
  );
}
