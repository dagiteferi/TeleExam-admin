import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE = import.meta.env.VITE_G12_API_BASE_URL || "http://127.0.0.1:8012";
const ACCESS = "g12_access_token";
const REFRESH = "g12_refresh_token";
const ADMIN = "g12_admin";

export type Role = "owner" | "admin" | "editor" | "viewer";

export interface G12Admin {
  id: string;
  email: string;
  role: Role;
}

export const g12Api = axios.create({ baseURL: `${BASE}/v1/admin` });

export const session = {
  access: () => localStorage.getItem(ACCESS),
  refresh: () => localStorage.getItem(REFRESH),
  admin: (): G12Admin | null => {
    const raw = localStorage.getItem(ADMIN);
    return raw ? (JSON.parse(raw) as G12Admin) : null;
  },
  save(access: string, refresh: string, admin?: G12Admin) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
    if (admin) localStorage.setItem(ADMIN, JSON.stringify(admin));
  },
  clear() {
    [ACCESS, REFRESH, ADMIN].forEach((key) => localStorage.removeItem(key));
  },
};

g12Api.interceptors.request.use((config) => {
  const token = session.access();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const refresh = session.refresh();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${BASE}/v1/admin/auth/refresh`, { refresh_token: refresh });
    session.save(data.access_token, data.refresh_token, data.admin);
    return data.access_token as string;
  } catch {
    return null;
  }
}

g12Api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = original?.url?.startsWith("/auth/");
    if (error.response?.status !== 401 || !original || original._retried || isAuthCall) {
      return Promise.reject(error);
    }
    original._retried = true;
    refreshing = refreshing ?? refreshAccess().finally(() => (refreshing = null));
    const token = await refreshing;
    if (!token) {
      session.clear();
      window.location.assign("/12/login");
      return Promise.reject(error);
    }
    original.headers.Authorization = `Bearer ${token}`;
    return g12Api(original);
  },
);

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const data = (err as AxiosError<{ error?: { message?: string }; detail?: unknown }>)?.response?.data;
  if (data?.error?.message) return data.error.message;
  if (typeof data?.detail === "string") return data.detail;
  if ((err as AxiosError)?.code === "ERR_NETWORK") return "Cannot reach the Grade 12 server.";
  return fallback;
}

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export function hasRole(admin: G12Admin | null, needed: Role): boolean {
  return !!admin && RANK[admin.role] >= RANK[needed];
}
