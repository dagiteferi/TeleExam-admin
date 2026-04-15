import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const API = axios.create({
  baseURL: API_BASE,
});

// =======================
// REQUEST INTERCEPTOR
// =======================

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token"); // ✅ FIXED

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// =======================
// RESPONSE INTERCEPTOR
// =======================

API.interceptors.response.use(
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

      localStorage.removeItem("admin_token"); // ✅ FIXED
      window.location.href = "/login";

    }

    return Promise.reject(error);
  }
);

export default API;
