import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login";
import RegisterPage from "./pages/register";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import DashboardPage from "./pages/dashboard";
import SettingsLayout from "./layouts/SettingsLayout";
import MFASetupPage from "./pages/settings/MFASetupPage";
import IntegrationPage from "./pages/settings/IntegrationPage";
import UserPage from "./pages/settings/UserPage";
import ProfilePage from "./pages/settings/ProfilePage";
import TenantPage from "./pages/settings/TenantPage";
import { useAuth } from "./shared/store/useAuth";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
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
  );
}

export default App;
