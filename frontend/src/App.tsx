import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useApp from './store/index.js';

// Layouts
import PublicLayout from './components/layout/PublicLayout.js';
import AppLayout from './components/layout/AppLayout.js';
import AdminLayout from './components/layout/AdminLayout.js';
import ProtectedRoute from './components/layout/ProtectedRoute.js';

// Public Pages
import LandingPage from './pages/public/LandingPage.js';
import AuthSkeleton from './pages/public/AuthSkeleton.js';

// App Dashboard Pages
import Dashboard from './pages/app/Dashboard.js';
import Leads from './pages/app/Leads.js';
import Proposals from './pages/app/Proposals.js';
import Workspaces from './pages/app/Workspaces.js';
import Escrow from './pages/app/Escrow.js';
import ProfileScan from './pages/app/ProfileScan.js';
import SecuritySettings from './pages/app/SecuritySettings.js';

// Admin Pages
import AdminAudit from './pages/admin/AdminAudit.js';

export const App: React.FC = () => {
  const { user, logout } = useApp();

  const isAuthenticated = !!user;
  const userRole = user?.role;

  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/waitlist" element={<AuthSkeleton mode="waitlist" />} />
        <Route path="/features" element={<LandingPage />} />
        <Route path="/how-it-works" element={<LandingPage />} />
        <Route path="/pricing" element={<LandingPage />} />
        <Route path="/security" element={<LandingPage />} />
        <Route path="/contact" element={<LandingPage />} />
        <Route path="/login" element={<AuthSkeleton mode="login" />} />
        <Route path="/signup" element={<AuthSkeleton mode="signup" />} />
      </Route>

      {/* Authenticated Dashboard Pages */}
      <Route
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} />
        }
      >
        <Route element={<AppLayout user={user!} onLogout={logout} />}>
          <Route path="/app/dashboard" element={<Dashboard />} />
          <Route path="/app/leads" element={<Leads />} />
          <Route path="/app/proposals" element={<Proposals />} />
          <Route path="/app/workspaces" element={<Workspaces />} />
          <Route path="/app/workspaces/:workspaceId" element={<Workspaces />} />
          <Route path="/app/escrow" element={<Escrow />} />
          <Route path="/app/escrow/:escrowId" element={<Escrow />} />
          <Route path="/app/profile" element={<ProfileScan />} />
          <Route path="/app/settings" element={<SecuritySettings />} />
        </Route>
      </Route>

      {/* Admin Governance Pages */}
      <Route
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} requiredRole="SUPER_ADMIN" userRole={userRole} />
        }
      >
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/audit" replace />} />
          <Route path="/admin/users" element={<AdminAudit mode="users" />} />
          <Route path="/admin/audit" element={<AdminAudit mode="audit" />} />
          <Route path="/admin/analytics" element={<AdminAudit mode="analytics" />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
export default App;
