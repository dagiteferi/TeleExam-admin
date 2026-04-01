import { jwtDecode } from "jwt-decode";

export type Permission = "view_users" | "ban_user" | "view_stats" | "manage_content" | "*";

export interface JwtPayload {
  sub?: string;
  email?: string;
  permissions?: Permission[];
  scope?: string;
  exp?: number;
  [key: string]: unknown;
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
  const raw =
    (payload.permissions as unknown) ??
    // common variants
    (payload as any).perms ??
    (payload as any).permission ??
    (payload as any).permissions;

  if (Array.isArray(raw)) return raw as Permission[];

  const scope = typeof payload.scope === "string" ? payload.scope : typeof (payload as any).scopes === "string" ? (payload as any).scopes : "";
  const fromScope = scope
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean) as Permission[];

  return fromScope;
}

export function decodeToken(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;

  const decoded = tryDecodeJwtPayload(token);
  if (!decoded) return null;

  if (typeof decoded.exp === "number" && decoded.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }

  const permissions = normalizePermissions(decoded);
  const email = (typeof decoded.email === "string" && decoded.email) || (typeof decoded.sub === "string" && decoded.sub) || "";

  return { ...decoded, email, permissions };
}

export function hasPermission(required: Permission): boolean {
  const payload = decodeToken();
  if (!payload) return false;
  const perms = payload.permissions ?? [];
  if (perms.includes("*")) return true;
  return perms.includes(required);
}

export function isSuperAdmin(): boolean {
  const payload = decodeToken();
  return payload?.permissions?.includes("*") ?? false;
}
