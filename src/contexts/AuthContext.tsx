import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { decodeToken, clearToken, setToken, getToken, Permission } from "@/lib/auth";

interface AuthUser {
  email: string;
  permissions: Permission[];
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  hasPermission: (perm: Permission) => boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const decoded = decodeToken();
    if (decoded) return { 
      email: decoded.email ?? "", 
      permissions: decoded.permissions ?? [],
      role: decoded.role as string | undefined
    };
    return getToken() ? { email: "", permissions: [] } : null;
  });

  const login = useCallback((token: string) => {
    setToken(token);
    const decoded = decodeToken();
    setUser(decoded ? { 
      email: decoded.email ?? "", 
      permissions: decoded.permissions ?? [],
      role: decoded.role as string | undefined
    } : { email: "", permissions: [] });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const isSuperAdmin = user?.role === "superadmin" || (user?.permissions.includes("*") ?? false);

  const hasPermission = useCallback(
    (perm: Permission) => {
      if (!user) return false;
      if (isSuperAdmin || user.permissions.includes("*")) return true;
      return user.permissions.includes(perm);
    },
    [user, isSuperAdmin]
  );

  // Check token expiry periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const decoded = decodeToken();
      const token = getToken();
      if (!token) setUser(null);
      else if (decoded) setUser({ 
        email: decoded.email ?? "", 
        permissions: decoded.permissions ?? [],
        role: decoded.role as string | undefined
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const isAuthenticated = !!getToken();

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, hasPermission, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
