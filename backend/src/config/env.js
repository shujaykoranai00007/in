import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer workspace root .env, then fall back to backend/.env for compatibility.
const rootEnvPath = path.resolve(__dirname, "../../../.env");
const backendEnvPath = path.resolve(__dirname, "../../.env");
const rootEnv = dotenv.config({ path: rootEnvPath });

if (rootEnv.error) {
  dotenv.config({ path: backendEnvPath });
}

const required = [
  "PORT",
  "MONGODB_URI",
  "JWT_SECRET",
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_USER_ID",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD"
];

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

const clean = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongodbUri: clean(process.env.MONGODB_URI),
  jwtSecret: clean(process.env.JWT_SECRET),
  instagramAccessToken: clean(process.env.INSTAGRAM_ACCESS_TOKEN),
  instagramUserId: clean(process.env.INSTAGRAM_USER_ID),
  adminEmail: clean(process.env.ADMIN_EMAIL),
  adminPassword: clean(process.env.ADMIN_PASSWORD),
  frontendOrigin: clean(process.env.FRONTEND_ORIGIN, "http://localhost:5173")
};
