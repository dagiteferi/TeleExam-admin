import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Role } from "./api";
import { useG12Auth } from "./auth";

export function G12Protected({ children, role = "viewer" }: { children: ReactNode; role?: Role }) {
  const { admin, can } = useG12Auth();
  const location = useLocation();
  if (!admin) return <Navigate to="/12/login" state={{ from: location.pathname }} replace />;
  if (!can(role)) {
    return <p className="text-sm text-muted-foreground p-6">Your role ({admin.role}) cannot open this page.</p>;
  }
  return <>{children}</>;
}
