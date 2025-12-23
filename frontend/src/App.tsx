import { useEffect, useRef, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./shared/store/useAuth";
import { ChatWidget } from "./components/ChatWidget";
import { SidebarLayout } from "./components/Sidebar";
import { PageContextProvider } from "./contexts/PageContext";
import { AdminProvider } from "./contexts/AdminContext";
import { LoadingState } from "./shared/ui";

// Lazy Load Pages
const LoginPage = lazy(() => import("./pages/login"));
const RegisterPage = lazy(() => import("./pages/register"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const SSOCallbackPage = lazy(() => import("./pages/auth/SSOCallbackPage"));
const DashboardPage = lazy(() => import("./pages/dashboard"));
const AICommandCenter = lazy(() => import("./pages/AICommandCenter"));

const LogViewerPage = lazy(() => import("./pages/log-viewer"));
const AlertsPage = lazy(() => import("./pages/alerts"));
const AutopilotPage = lazy(() => import("./pages/autopilot"));

const CaseBoardPage = lazy(() => import("./pages/cases"));
const CaseDetailPage = lazy(() => import("./pages/cases/CaseDetailPage"));
const ObservablesPage = lazy(() => import("./pages/observables/ObservablesPage"));
const ThreatIntelPage = lazy(() => import("./pages/ThreatIntelPage"));
const PlaybooksPage = lazy(() => import("./pages/playbooks/PlaybooksPage"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const HuntingPage = lazy(() => import("./pages/HuntingPage"));

const AdminDashboard = lazy(() => import("./pages/admin"));

// Settings Pages
const SettingsLayout = lazy(() => import("./layouts/SettingsLayout"));
const SSOPage = lazy(() => import("./pages/settings/SSOPage"));
const MFASetupPage = lazy(() => import("./pages/settings/MFASetupPage"));
const IntegrationPage = lazy(() => import("./pages/settings/IntegrationPage"));
const NotificationChannelsPage = lazy(() => import("./pages/settings/NotificationChannelsPage"));
const UserPage = lazy(() => import("./pages/settings/UserPage"));
const TenantPage = lazy(() => import("./pages/settings/TenantPage"));
const RetentionSettingsPage = lazy(() => import("./pages/settings/RetentionSettingsPage"));
const ParsersPage = lazy(() => import("./pages/settings/ParsersPage"));
const EDRActionsPage = lazy(() => import("./pages/settings/EDRActionsPage"));
const AuditLogsPage = lazy(() => import("./pages/settings/AuditLogsPage"));
const ProfilePage = lazy(() => import("./pages/settings/ProfilePage"));
const DetectionRulesPage = lazy(() => import("./pages/settings/DetectionRulesPage"));
const SystemPage = lazy(() => import("./pages/settings/SystemPage"));
const SubscriptionPage = lazy(() => import("./pages/settings/SubscriptionPage")); // Added

// Import logos for preloading (Keep static for fast LCP if used early, but typically lazy loading images is also good)
import sentineloneLogo from './assets/logo/sentinelone.png';
import crowdstrikeLogo from './assets/logo/crowdstrike.png';

// Preload images
const preloadImages = () => {
  const images = [sentineloneLogo, crowdstrikeLogo];
  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
};

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // 🔓 BYPASS MODE: Skip authentication (Frontend + Backend)
  // ⚠️ WARNING: Only use for DEMO/TESTING!
  const isDev = import.meta.env.DEV;
  const bypassAuth = isDev || import.meta.env.VITE_BYPASS_AUTH === 'true';
  
  if (bypassAuth) {
    console.log('🔓 [Frontend] BYPASS MODE: Auth skipped');
    console.warn('⚠️  WARNING: Running in DEMO mode - No authentication!');
    return (
      <AdminProvider userRole={'superadmin'}>
        <SidebarLayout>
          {children}
        </SidebarLayout>
        <ChatWidget />
      </AdminProvider>
    );
  }
  
  // Production: Normal auth flow
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoadingState />
      </div>
    );
  }
  
  return isAuthenticated ? (
    <AdminProvider userRole={user?.role || ''}>
      <SidebarLayout>
        {children}
      </SidebarLayout>
      <ChatWidget />
    </AdminProvider>
  ) : <Navigate to="/login" />;
}

// Route for Super Admin
function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoadingState />
      </div>
    );
  }
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'superadmin') return <Navigate to="/dashboard" />;
  
  return (
    <AdminProvider userRole={user?.role || ''}>
      <SidebarLayout>
        {children}
      </SidebarLayout>
    </AdminProvider>
  );
}

function App() {
  const { checkAuth } = useAuth();
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    // Don't check auth on login/register pages to avoid 401 loop
    const isAuthPage = window.location.pathname.startsWith('/login') || 
                       window.location.pathname.startsWith('/register');
    
    if (!hasCheckedAuth.current && !isAuthPage) {
      hasCheckedAuth.current = true;
      checkAuth();
      preloadImages();
    } else if (isAuthPage) {
      // Just preload images on auth pages
      preloadImages();
    }
  }, [checkAuth]);

  return (
    <PageContextProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><LoadingState message="Loading application..." /></div>}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/callback" element={<SSOCallbackPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            
            {/* Protected Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ai-command" 
              element={
                <ProtectedRoute>
                  <AICommandCenter />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/autopilot" 
              element={
                <ProtectedRoute>
                  <AutopilotPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/logs" 
              element={
                <ProtectedRoute>
                  <LogViewerPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/detections" 
              element={
                <ProtectedRoute>
                  <AlertsPage />
                </ProtectedRoute>
              } 
            />
            {/* Redirect old alerts path */}
            <Route path="/alerts" element={<Navigate to="/detections" replace />} />

            {/* Redirect old queue path */}
            <Route path="/queue" element={<Navigate to="/detections?status=new" replace />} />





            <Route 
              path="/cases" 
              element={
                <ProtectedRoute>
                  <CaseBoardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cases/:id" 
              element={
                <ProtectedRoute>
                  <CaseDetailPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/observables" 
              element={
                <ProtectedRoute>
                  <ObservablesPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/threat-intel" 
              element={
                <ProtectedRoute>
                  <ThreatIntelPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/rules" 
              element={
                <ProtectedRoute>
                  <DetectionRulesPage />
                </ProtectedRoute>
              } 
            />
            {/* Redirect old detection path */}
            <Route path="/detection" element={<Navigate to="/rules" replace />} />
            <Route 
              path="/playbooks" 
              element={
                <ProtectedRoute>
                  <PlaybooksPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hunting" 
              element={
                <ProtectedRoute>
                  <HuntingPage />
                </ProtectedRoute>
              } 
            />

            {/* Super Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <SuperAdminRoute>
                  <AdminDashboard />
                </SuperAdminRoute>
              } 
            />

            {/* Settings Routes */}
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <SettingsLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="sso" element={<SSOPage />} />
              <Route path="mfa" element={<MFASetupPage />} />
              <Route path="integrations" element={<IntegrationPage />} />
              <Route path="notifications" element={<NotificationChannelsPage />} />
              <Route path="users" element={<UserPage />} />
              <Route path="tenants" element={<TenantPage />} />
              <Route path="retention" element={<RetentionSettingsPage />} />
              <Route path="parsers" element={<ParsersPage />} />
              <Route path="edr-actions" element={<EDRActionsPage />} />
              <Route path="system" element={<SystemPage />} />

              <Route path="threat-intel" element={
                <Suspense fallback={<LoadingState />}>
                  <ThreatIntelPage />
                </Suspense>
              } />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              {/* Detection Rules moved to /detection as standalone route */}
              <Route path="subscription" element={<SubscriptionPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </PageContextProvider>
  );
}

export default App;
