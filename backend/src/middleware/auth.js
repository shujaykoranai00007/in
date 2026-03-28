import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

function isLocalRequest(req) {
  const host = String(req.hostname || "").toLowerCase();
  const forwardedHost = String(req.get("x-forwarded-host") || "").toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    forwardedHost.includes("localhost") ||
    forwardedHost.includes("127.0.0.1")
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  // Localhost-only bypass support for development mode.
  // This keeps hosted environments unaffected.
  if (
    token === "local-bypass-token" &&
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_LOCAL_BYPASS_AUTH !== "false" &&
    isLocalRequest(req)
  ) {
    req.user = {
      sub: "local-admin@instaflow.dev",
      role: "admin",
      bypass: true
    };
    return next();
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
