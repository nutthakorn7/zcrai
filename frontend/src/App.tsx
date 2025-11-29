import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login";
import RegisterPage from "./pages/register";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import DashboardPage from "./pages/dashboard";
import LogViewerPage from "./pages/log-viewer";
import AdminDashboard from "./pages/admin";
import SettingsLayout from "./layouts/SettingsLayout";
import MFASetupPage from "./pages/settings/MFASetupPage";
import IntegrationPage from "./pages/settings/IntegrationPage";
import UserPage from "./pages/settings/UserPage";
import ProfilePage from "./pages/settings/ProfilePage";
import TenantPage from "./pages/settings/TenantPage";
import { useAuth } from "./shared/store/useAuth";
import { ChatWidget } from "./components/ChatWidget";
import { PageContextProvider } from "./contexts/PageContext";
import { AdminProvider } from "./contexts/AdminContext";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // แสดง loading ขณะ check auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return isAuthenticated ? (
    <AdminProvider userRole={user?.role || ''}>
      {children}
      <ChatWidget />
    </AdminProvider>
  ) : <Navigate to="/login" />;
}

// Route เฉพาะ Super Admin
function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'superadmin') return <Navigate to="/dashboard" />;
  
  return (
    <AdminProvider userRole={user?.role || ''}>
      {children}
    </AdminProvider>
  );
}

function App() {
  const { checkAuth } = useAuth();

  useEffect(() => {
    checkAuth();
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
          <Route path="users" element={<UserPage />} />
          <Route path="tenants" element={<TenantPage />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </PageContextProvider>
  );
}

export default App;
