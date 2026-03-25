import axios from "axios";

function isLikelyFrontendHost(hostname = "") {
  const host = String(hostname || "").toLowerCase();
  return host.endsWith(".vercel.app") || host.endsWith(".netlify.app");
}

function normalizeApiEnvUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return "";
  }

  // Allow explicit same-origin API proxy path.
  if (value.startsWith("/")) {
    return value.replace(/\/+$/, "") || "/api";
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    // Prevent accidental frontend-domain API URLs that break all dashboard actions.
    if (isLikelyFrontendHost(parsed.hostname)) {
      return "";
    }

    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return "";
  }
}

function resolveApiBaseUrl() {
  const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
  const envBase = normalizeApiEnvUrl(import.meta.env.VITE_API_URL);

  // In local dev, prefer localhost backend; fall back to local port 5000.
  if (isLocalhost) {
    const envLooksLocal =
      typeof envBase === "string" &&
      (envBase.startsWith("http://localhost:") || envBase.startsWith("http://127.0.0.1:"));
    return envLooksLocal ? envBase : "http://localhost:5000/api";
  }

  // In hosted/production builds, use the env var injected at build time (e.g. from Vercel).
  // Prefer same-origin API proxy in production to avoid CORS and cold-start preflight issues.
  return envBase || "/api";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("auth_token") || localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
