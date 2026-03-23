import axios from "axios";

function resolveApiBaseUrl() {
  const envBase = import.meta.env.VITE_API_URL;
  const renderFallback = "https://instaflowinstaflow-backend.onrender.com/api";
  const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";

  if (isLocalhost) {
    const envLooksLocal =
      typeof envBase === "string" &&
      (envBase.startsWith("http://localhost:") || envBase.startsWith("http://127.0.0.1:"));

    if (envLooksLocal) {
      return envBase;
    }

    return "http://localhost:5000/api";
  }

  if (envBase) {
    const envLooksLocal =
      typeof envBase === "string" &&
      (envBase.startsWith("http://localhost:") || envBase.startsWith("http://127.0.0.1:"));

    // Ignore localhost API in hosted builds (common Vercel env misconfiguration).
    if (!isLocalhost && envLooksLocal) {
      return renderFallback;
    }

    return envBase;
  }

  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return renderFallback;
  }

  return "http://localhost:5000/api";
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
