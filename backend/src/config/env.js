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

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
  instagramUserId: process.env.INSTAGRAM_USER_ID,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173"
};
