import { jwtDecode } from "jwt-decode";
import API from "./api";

// 🔑 Use ONE consistent key
const TOKEN_KEY = "admin_token";

export type Permission =
  | "view_users"
  | "ban_user"
  | "view_stats"
  | "manage_content"
  | "*";

interface JwtPayload {
  sub: string;
  email: string;
  permissions: Permission[];
  exp: number;
}

// =======================
// TOKEN HELPERS
// =======================

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// =======================
// LOGIN (CRITICAL FIX)
// =======================

export async function login(email: string, password: string) {
  const params = new URLSearchParams();
  params.append("username", email); // MUST be username
  params.append("password", password);

  const res = await API.post("/admin/auth/login", params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const token = res.data.access_token;

  setToken(token);

  return decodeToken();
}

// =======================
// LOGOUT
// =======================

export function logout() {
  clearToken();
  window.location.href = "/login";
}

// =======================
// JWT DECODE
// =======================

export function decodeToken(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;

  try {
    const decoded = jwtDecode<JwtPayload>(token);

    // ⏰ Check expiration
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

// =======================
// PERMISSIONS
// =======================

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
