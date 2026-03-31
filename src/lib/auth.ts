import { jwtDecode } from "jwt-decode";

export type Permission = "view_users" | "ban_user" | "view_stats" | "manage_content" | "*";

interface JwtPayload {
  sub: string;
  email: string;
  permissions: Permission[];
  exp: number;
}

export function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem("access_token");
}

export function decodeToken(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    if (decoded.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return decoded;
  } catch {
    clearToken();
    return null;
  }
}

export function hasPermission(required: Permission): boolean {
  const payload = decodeToken();
  if (!payload) return false;
  if (payload.permissions.includes("*")) return true;
  return payload.permissions.includes(required);
}

export function isSuperAdmin(): boolean {
  const payload = decodeToken();
  return payload?.permissions.includes("*") ?? false;
}
