import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Permission } from "@/lib/auth";

interface Props {
  children: React.ReactNode;
  permission?: Permission;
  superAdminOnly?: boolean;
}

export function ProtectedRoute({ children, permission, superAdminOnly }: Props) {
  const { isAuthenticated, hasPermission, isSuperAdmin } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (superAdminOnly && !isSuperAdmin) return <Navigate to="/" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
