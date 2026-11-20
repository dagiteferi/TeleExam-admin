import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { g12Api, hasRole, session, type G12Admin, type Role } from "./api";

interface G12Auth {
  admin: G12Admin | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (role: Role) => boolean;
}

const G12AuthContext = createContext<G12Auth | null>(null);

export function G12AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<G12Admin | null>(() => session.admin());

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await g12Api.post("/auth/login", { email, password });
    session.save(data.access_token, data.refresh_token, data.admin);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(async () => {
    const refresh = session.refresh();
    if (refresh) await g12Api.post("/auth/logout", { refresh_token: refresh }).catch(() => undefined);
    session.clear();
    setAdmin(null);
  }, []);

  const value = useMemo(() => ({ admin, login, logout, can: (role: Role) => hasRole(admin, role) }),
    [admin, login, logout]);
  return <G12AuthContext.Provider value={value}>{children}</G12AuthContext.Provider>;
}

export function useG12Auth(): G12Auth {
  const value = useContext(G12AuthContext);
  if (!value) throw new Error("useG12Auth must be used inside G12AuthProvider");
  return value;
}
