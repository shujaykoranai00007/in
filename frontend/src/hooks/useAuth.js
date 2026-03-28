import { useEffect, useState } from "react";
import api from "../services/api";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

function shouldBypassLogin() {
  if (typeof window === "undefined") {
    return false;
  }

  const flag = String(import.meta.env.VITE_BYPASS_LOGIN || "").toLowerCase() === "true";
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return flag && isLocalhost;
}

function getBypassUser() {
  return {
    email: "local-admin@instaflow.dev",
    name: "Local Admin"
  };
}

function readToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

function readUser() {
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function useAuth() {
  const bypassEnabled = shouldBypassLogin();
  const [token, setToken] = useState(() => (bypassEnabled ? "local-bypass-token" : readToken()));
  const [user, setUser] = useState(() => (bypassEnabled ? getBypassUser() : readUser()));
  const [instagramStatus, setInstagramStatus] = useState(null);

  async function validateSession() {
    try {
      await api.get("/auth/me");
      return true;
    } catch {
      // Any failure here means current token/session cannot be trusted for API actions.
      // Force re-login so the UI does not stay in a broken "logged in but nothing works" state.
      return false;
    }
  }

  useEffect(() => {
    let mounted = true;

    if (bypassEnabled) {
      // Keep storage in sync so axios interceptor can send auth header in localhost bypass mode.
      sessionStorage.setItem(TOKEN_KEY, "local-bypass-token");
      sessionStorage.setItem(USER_KEY, JSON.stringify(getBypassUser()));
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setInstagramStatus({ valid: true, username: "local-bypass" });
      return () => {
        mounted = false;
      };
    }

    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
      validateSession().then((ok) => {
        if (!mounted) {
          return;
        }

        if (!ok) {
          setToken(null);
          setUser(null);
          setInstagramStatus(null);
          return;
        }

        validateInstagramToken();
      });
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    return () => {
      mounted = false;
    };
  }, [token, bypassEnabled]);

  async function validateInstagramToken() {
    if (bypassEnabled) {
      setInstagramStatus({ valid: true, username: "local-bypass" });
      return;
    }

    try {
      const { data } = await api.get("/auth/instagram-token-status");
      setInstagramStatus({ valid: true, username: data.username });
    } catch (error) {
      const errorMsg = error?.response?.data?.error || "Instagram token is invalid";
      setInstagramStatus({ valid: false, error: errorMsg });
      console.warn("Instagram token validation failed:", errorMsg);
    }
  }

  async function login(email, password) {
    if (bypassEnabled) {
      const nextUser = getBypassUser();
      setToken("local-bypass-token");
      setUser(nextUser);
      setInstagramStatus({ valid: true, username: "local-bypass" });
      return;
    }

    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    sessionStorage.setItem(TOKEN_KEY, data.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    await validateInstagramToken();
  }

  function logout() {
    if (bypassEnabled) {
      // Keep local bypass active during dev preview sessions.
      return;
    }

    setToken(null);
    setUser(null);
    setInstagramStatus(null);
  }

  return {
    token,
    user,
    isAuthenticated: Boolean(token),
    login,
    logout,
    instagramStatus,
    validateInstagramToken
  };
}
