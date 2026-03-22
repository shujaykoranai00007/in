import { useEffect, useState } from "react";
import api from "../services/api";

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("auth_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [instagramStatus, setInstagramStatus] = useState(null);

  async function validateSession() {
    try {
      await api.get("/auth/me");
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let mounted = true;

    if (token) {
      localStorage.setItem("auth_token", token);
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
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }

    return () => {
      mounted = false;
    };
  }, [token]);

  async function validateInstagramToken() {
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
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    await validateInstagramToken();
  }

  function logout() {
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
