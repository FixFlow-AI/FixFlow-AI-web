import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  isAuthenticated: boolean;
  requiredRole?: string;
  userRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  requiredRole,
  userRole
}) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    // If user is not admin, redirect to app dashboard
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
};
export default ProtectedRoute;
