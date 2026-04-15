import { jwtDecode } from "jwt-decode";
import API from "./api";

const TOKEN_KEY = "admin_token";

export type Permission =
  | "view_users"
  | "ban_user"
  | "view_stats"
  | "manage_content"
  | "*";

export interface JwtPayload {
  sub?: string;
  email?: string;
  permissions?: Permission[];
  scope?: string;
  exp?: number;
  [key: string]: unknown;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function tryDecodeJwtPayload(token: string): JwtPayload | null {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const json = base64UrlDecode(parts[1]);
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }
}

function normalizePermissions(payload: JwtPayload): Permission[] {
  const raw = (payload.permissions as unknown) ?? (payload as any).perms ?? (payload as any).permissions;
  if (Array.isArray(raw)) return raw as Permission[];
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  return scope.split(/\s+/).filter(Boolean) as Permission[];
}

export async function login(email: string, password: string) {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);

  const res = await API.post("/admin/auth/login", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const token = res.data.access_token;
  setToken(token);
  return decodeToken();
}

export function logout() {
  clearToken();
  window.location.href = "/login";
}

export function decodeToken(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;

  try {
    const decoded = tryDecodeJwtPayload(token);
    if (!decoded) return null;

    if (typeof decoded.exp === "number" && decoded.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }

    const permissions = normalizePermissions(decoded);
    const email = (typeof decoded.email === "string" && decoded.email) || (typeof decoded.sub === "string" && decoded.sub) || "";

    return { ...decoded, email, permissions };
  } catch {
    clearToken();
    return null;
  }
}

export function hasPermission(required: Permission): boolean {
  const payload = decodeToken();
  if (!payload || !payload.permissions) return false;
  if (payload.permissions.includes("*")) return true;
  return payload.permissions.includes(required);
}

export function isSuperAdmin(): boolean {
  const payload = decodeToken();
  return payload?.permissions?.includes("*") ?? false;
}
