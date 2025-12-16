import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from '@heroui/react';
import { Icon } from '../shared/ui';
import { useAuth } from '../shared/store/useAuth';
import { NotificationBell } from './NotificationBell';
import ZcrAILogo from '../assets/logo/zcrailogo.svg';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  adminOnly?: boolean;
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const navItems: NavItem[] = [
    // 1. Overview
    { 
      icon: Icon.Dashboard, 
      label: 'Dashboard', 
      path: '/dashboard' 
    },
    { 
      icon: Icon.Chart, 
      label: 'Reports', 
      path: '/reports' 
    },

    // 2. Operations
    { 
      icon: Icon.Briefcase, 
      label: 'Cases', 
      path: '/cases' 
    },
    { 
      icon: Icon.Alert, 
      label: 'Alerts', 
      path: '/alerts' 
    },
    { 
      icon: Icon.CheckCircle, 
      label: 'Actions', 
      path: '/approvals' 
    },
    { 
      icon: Icon.Shield, 
      label: 'Threat Intel', 
      path: '/threat-intel' 
    },

    // 3. Investigation
    { 
      icon: Icon.Document, 
      label: 'Logs', 
      path: '/logs' 
    },
    { 
      icon: Icon.Search, 
      label: 'Observables', 
      path: '/observables' 
    },
    { 
      icon: Icon.Shield, 
      label: 'Threat Intel', 
      path: '/threat-intel' 
    },

    // 4. Engineering
    { 
      icon: Icon.Terminal, 
      label: 'Playbooks', 
      path: '/playbooks' 
    },
    { 
      icon: Icon.Eye, // Or another icon like Target/Scan
      label: 'Detection', 
      path: '/settings/detection-rules' 
    },
    // 6. Settings
    { icon: Icon.Settings, label: 'Settings', path: '/settings/profile' },
    { icon: Icon.CreditCard, label: 'Subscription', path: '/settings/subscription' }, // Added
    { icon: Icon.Server, label: 'System', path: '/settings/system' },
    { 
      icon: Icon.Users, 
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
    <aside 
      className={`
        fixed left-0 top-0 h-screen bg-content1 border-r border-white/5 flex flex-col py-4 z-50
        transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isExpanded ? 'w-[240px]' : 'w-[70px]'}
      `}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className={`mb-8 px-3 flex items-center gap-3 ${isExpanded ? '' : 'justify-center'}`}>
        <button
          onClick={() => navigate('/dashboard')}
          className="group relative rounded-xl cursor-pointer flex-shrink-0 transition-all duration-300"
          aria-label="Go to dashboard"
        >
          {/* Glow Effect */}
          <div className="absolute inset-0 rounded-xl bg-primary/0 group-hover:bg-primary/50 blur-xl transition-all duration-300 group-hover:blur-2xl" />
          
          {/* Logo */}
          <img src={ZcrAILogo} alt="zcrAI Logo" className="w-16 h-16 relative z-10 transition-transform duration-300 group-hover:scale-105" />
        </button>
        <div 
          className={`
            overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}
          `}
        >
          <span className="text-lg font-semibold text-foreground whitespace-nowrap">
            zcrAI
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-1.5 px-3" aria-label="Primary navigation">
        {navItems.map((item) => {
          // ซ่อน Admin menu ถ้าไม่ใช่ superadmin
          if (item.adminOnly && user?.role !== 'superadmin') return null;
          
          const active = isActive(item.path);
          const IconComponent = item.icon;
          
          return (
            <Tooltip 
              key={item.path}
              content={item.label}
              placement="right"
              delay={300}
              isDisabled={isExpanded}
              classNames={{
                base: "py-2 px-4 rounded-lg",
                content: "bg-content2 text-foreground text-sm font-medium border border-white/5"
              }}
            >
              <button
                onClick={() => navigate(item.path)}
                className={`
                  relative p-3 rounded-xl transition-all duration-200
                  flex items-center gap-3 w-full
                  ${active 
                    ? 'bg-content2 text-foreground' 
                    : 'text-foreground/60 hover:text-foreground hover:bg-content2/50'
                  }
                  ${isExpanded ? 'justify-start' : 'justify-center'}
                `}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                {/* Active Indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                )}
                
                {/* Icon */}
                <IconComponent className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                
                {/* Label */}
                <div 
                  className={`
                    overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
                    ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}
                  `}
                >
                  <span className="text-sm font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                </div>
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom: Logout */}
      <div className="mt-auto flex flex-col gap-1.5 px-3">
        <Tooltip 
          content="Logout"
          placement="right"
          delay={300}
          isDisabled={isExpanded}
          classNames={{
            base: "py-2 px-4 rounded-lg",
            content: "bg-content2 text-foreground text-sm font-medium border border-white/5"
          }}
        >
          <button
            onClick={handleLogout}
            className={`
              p-3 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-500/10
              transition-all duration-200 flex items-center gap-3 w-full
              ${isExpanded ? 'justify-start' : 'justify-center'}
            `}
            aria-label="Logout"
          >
            <Icon.Logout className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <div 
              className={`
                overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
                ${isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'}
              `}
            >
              <span className="text-sm font-medium whitespace-nowrap">
                Logout
              </span>
            </div>
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}

// Layout Wrapper with Sidebar
export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-[70px] flex flex-col">
        {/* Top Navbar */}
        <div className="sticky top-0 z-30 h-16 bg-content1/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-end px-6">
          <NotificationBell />
        </div>
        
        {/* Main Content */}
        <main className="flex-1" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
