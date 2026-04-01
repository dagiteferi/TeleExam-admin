import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const detail = error.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => (typeof d?.msg === "string" ? d.msg : "")).join(" ")
            : "";

      // Only force-logout on *auth* failures, not on permission/route guards.
      // Some backends return 401 for "not enough permissions"; we must not wipe the token in that case.
      const looksLikeAuthFailure =
        /could not validate credentials|not authenticated|invalid token|token|signature/i.test(msg);

      // IMPORTANT: Don't logout on empty/unknown 401 bodies; it creates redirect loops.
      if (looksLikeAuthFailure) {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
