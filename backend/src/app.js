import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { postRouter } from "./routes/post.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { autoAnimeRouter } from "./routes/auto-anime.routes.js";
import { musicRouter } from "./routes/music.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads");
const musicDir = path.resolve(__dirname, "../music-library");

const allowedOrigins = new Set([
  ...(env.frontendOrigin || "").split(",").map((origin) => origin.trim()).filter(Boolean),
  "http://localhost:5173",
  "http://localhost:5174"
]);

function isTrustedHostedOrigin(origin = "") {
  if (!origin) {
    return false;
  }

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") {
      return false;
    }

    return hostname.endsWith(".onrender.com") || hostname.endsWith(".vercel.app") || hostname.endsWith(".netlify.app");
  } catch {
    return false;
  }
}

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin or non-browser requests (no Origin header)
      if (!origin || allowedOrigins.has(origin) || isTrustedHostedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/", (_req, res) => {
  res.json({
    service: "instaflow-backend",
    status: "ok",
    message: "API is running. Use /health or /api/* endpoints."
  });
});

app.use("/media", express.static(uploadsDir));
app.use("/music-library", express.static(musicDir));

app.use("/api/auth", authRouter);
app.use("/api/posts", postRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/auto-anime", autoAnimeRouter);
app.use("/api/music", musicRouter);

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "File too large. Max allowed is 300MB." });
    }

    return res.status(400).json({ message: err.message || "Upload failed" });
  }

  if (typeof err?.message === "string") {
    if (err.message.includes("Unsupported file type")) {
      return res.status(415).json({ message: err.message });
    }

    if (err.message.includes("ffmpeg") || err.message.includes("Error while filtering")) {
      return res.status(422).json({
        message:
          "Video processing failed. Try another MP4/MOV clip (recommended: H.264 + AAC, up to 60s)."
      });
    }

    if (err.message === "Not allowed by CORS") {
      return res.status(403).json({ message: "Request origin is not allowed" });
    }
  }

  console.error(err);
  return res.status(500).json({ message: "Unexpected server error" });
});

export default app;
