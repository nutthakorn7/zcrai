import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login";
import RegisterPage from "./pages/register";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import DashboardPage from "./pages/dashboard";
import LogViewerPage from "./pages/log-viewer";
import AlertsPage from "./pages/alerts";
import AdminDashboard from "./pages/admin";
import SettingsLayout from "./layouts/SettingsLayout";
import MFASetupPage from "./pages/settings/MFASetupPage";
import IntegrationPage from "./pages/settings/IntegrationPage";
import PlaybooksPage from "./pages/playbooks/PlaybooksPage";
import ReportsPage from "./pages/reports/ReportsPage";
import UserPage from "./pages/settings/UserPage";
import ProfilePage from "./pages/settings/ProfilePage";
import TenantPage from "./pages/settings/TenantPage";
import NotificationChannelsPage from "./pages/settings/NotificationChannelsPage";
import RetentionSettingsPage from "./pages/settings/RetentionSettingsPage";
import CaseBoardPage from "./pages/cases";
import CaseDetailPage from "./pages/cases/CaseDetailPage";
import AlertQueuePage from "./pages/alerts/AlertQueuePage";
import ObservablesPage from "./pages/observables/ObservablesPage";
import { useAuth } from "./shared/store/useAuth";
import { ChatWidget } from "./components/ChatWidget";
import { SidebarLayout } from "./components/Sidebar";
import { PageContextProvider } from "./contexts/PageContext";
import { AdminProvider } from "./contexts/AdminContext";

// Import logos for preloading
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
  
  // แสดง loading ขณะ check auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

// Route เฉพาะ Super Admin
function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

  useEffect(() => {
    checkAuth();
    preloadImages();
  }, []);

  return (
    <PageContextProvider>
      <BrowserRouter>
        <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
          path="/logs" 
          element={
            <ProtectedRoute>
              <LogViewerPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/alerts" 
          element={
            <ProtectedRoute>
              <AlertsPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/queue" 
          element={
            <ProtectedRoute>
              <AlertQueuePage />
            </ProtectedRoute>
          } 
        />

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
          <Route path="mfa" element={<MFASetupPage />} />
          <Route path="integrations" element={<IntegrationPage />} />
          <Route path="notifications" element={<NotificationChannelsPage />} />
          <Route path="users" element={<UserPage />} />
          <Route path="tenants" element={<TenantPage />} />
          <Route path="retention" element={<RetentionSettingsPage />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </PageContextProvider>
  );
}

export default App;
