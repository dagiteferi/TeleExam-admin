import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { decodeToken, clearToken, setToken, Permission } from "@/lib/auth";

interface AuthUser {
  email: string;
  permissions: Permission[];
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
    return decoded ? { email: decoded.email, permissions: decoded.permissions } : null;
  });

  const login = useCallback((token: string) => {
    setToken(token);
    const decoded = decodeToken();
    if (decoded) {
      setUser({ email: decoded.email, permissions: decoded.permissions });
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (perm: Permission) => {
      if (!user) return false;
      if (user.permissions.includes("*")) return true;
      return user.permissions.includes(perm);
    },
    [user]
  );

  const isSuperAdmin = user?.permissions.includes("*") ?? false;

  // Check token expiry periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const decoded = decodeToken();
      if (!decoded && user) {
        setUser(null);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, hasPermission, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
