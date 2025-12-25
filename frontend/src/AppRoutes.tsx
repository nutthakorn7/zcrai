import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./shared/store/useAuth";
import { ChatWidget } from "./components/ChatWidget";
import { SidebarLayout } from "./components/Sidebar";
import { AdminProvider } from "./contexts/AdminContext";
import { LoadingState } from "./shared/ui";

// Lazy Load Pages
const LoginPage = lazy(() => import("./pages/login/LoginPage"));
const RegisterPage = lazy(() => import("./pages/register/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const SSOCallbackPage = lazy(() => import("./pages/auth/SSOCallbackPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const AICommandCenter = lazy(() => import("./pages/ai-command/AICommandCenter"));
const InvestigationsPage = lazy(() => import("./pages/investigations/InvestigationsPage"));
const LogViewerPage = lazy(() => import("./pages/log-viewer/LogViewerPage"));
const AlertsPage = lazy(() => import("./pages/alerts/AlertsPage"));
const AutopilotPage = lazy(() => import("./pages/autopilot/AutopilotPage"));
const CaseBoardPage = lazy(() => import("./pages/cases/CaseBoardPage"));
const CaseDetailPage = lazy(() => import("./pages/cases/CaseDetailPage"));
const ObservablesPage = lazy(() => import("./pages/observables/ObservablesPage"));
const ThreatIntelPage = lazy(() => import("./pages/threat-intel/ThreatIntelPage"));
const PlaybooksPage = lazy(() => import("./pages/playbooks/PlaybooksPage"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const ApprovalsPage = lazy(() => import("./pages/approvals/ApprovalsPage"));
const InputsPage = lazy(() => import("./pages/approvals/InputsPage"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));

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
const SubscriptionPage = lazy(() => import("./pages/settings/SubscriptionPage"));

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isDev = import.meta.env.DEV;
  const bypassAuth = isDev || import.meta.env.VITE_BYPASS_AUTH === 'true';
  
  if (bypassAuth) {
    return (
      <AdminProvider userRole={'superadmin'}>
        <SidebarLayout>{children}</SidebarLayout>
        <ChatWidget />
      </AdminProvider>
    );
  }
  
  if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-background"><LoadingState /></div>;
  
  return isAuthenticated ? (
    <AdminProvider userRole={user?.role || ''}>
      <SidebarLayout>{children}</SidebarLayout>
      <ChatWidget />
    </AdminProvider>
  ) : <Navigate to="/login" />;
}

function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-background"><LoadingState /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'superadmin') return <Navigate to="/dashboard" />;
  
  return (
    <AdminProvider userRole={user?.role || ''}>
      <SidebarLayout>{children}</SidebarLayout>
    </AdminProvider>
  );
}

export const AppRoutes = () => (
  <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><LoadingState message="Loading application..." /></div>}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/callback" element={<SSOCallbackPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/ai-command" element={<ProtectedRoute><AICommandCenter /></ProtectedRoute>} />
      <Route path="/investigations" element={<ProtectedRoute><InvestigationsPage /></ProtectedRoute>} />
      <Route path="/enterprise-insights" element={<Navigate to="/investigations" replace />} />
      <Route path="/autopilot" element={<ProtectedRoute><AutopilotPage /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><LogViewerPage /></ProtectedRoute>} />
      <Route path="/detections" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
      <Route path="/alerts" element={<Navigate to="/detections" replace />} />
      <Route path="/queue" element={<Navigate to="/detections?status=new" replace />} />
      <Route path="/cases" element={<ProtectedRoute><CaseBoardPage /></ProtectedRoute>} />
      <Route path="/cases/:id" element={<ProtectedRoute><CaseDetailPage /></ProtectedRoute>} />
      <Route path="/observables" element={<ProtectedRoute><ObservablesPage /></ProtectedRoute>} />
      <Route path="/threat-intel" element={<ProtectedRoute><ThreatIntelPage /></ProtectedRoute>} />
      <Route path="/rules" element={<ProtectedRoute><DetectionRulesPage /></ProtectedRoute>} />
      <Route path="/detection" element={<Navigate to="/rules" replace />} />
      <Route path="/playbooks" element={<ProtectedRoute><PlaybooksPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/approvals/inputs" element={<ProtectedRoute><InputsPage /></ProtectedRoute>} />
      <Route path="/hunting" element={<Navigate to="/logs" replace />} />
      <Route path="/admin" element={<SuperAdminRoute><AdminDashboard /></SuperAdminRoute>} />

      <Route path="/settings" element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}>
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
        <Route path="threat-intel" element={<Suspense fallback={<LoadingState />}><ThreatIntelPage /></Suspense>} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
      </Route>
    </Routes>
  </Suspense>
);
