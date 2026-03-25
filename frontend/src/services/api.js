import axios from "axios";

function resolveApiBaseUrl() {
  const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";

  // In local dev, prefer localhost backend; fall back to local port 5000.
  if (isLocalhost) {
    const envBase = import.meta.env.VITE_API_URL;
    const envLooksLocal =
      typeof envBase === "string" &&
      (envBase.startsWith("http://localhost:") || envBase.startsWith("http://127.0.0.1:"));
    return envLooksLocal ? envBase : "http://localhost:5000/api";
  }

  // In hosted/production builds, use the env var injected at build time (e.g. from Vercel).
  // Fall back to the correct production Render backend.
  const envBase = import.meta.env.VITE_API_URL;
  return envBase || "https://instaflow-9nox.onrender.com/api";
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
