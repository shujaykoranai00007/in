import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { startScheduler } from "./scheduler/cron.js";
import mongoose from "mongoose";
import sharp from "sharp";

// Disable sharp cache to save RAM on 512MB tier
sharp.cache(false);

// Global Error Resilience - prevent app from crashing on intermittent errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[CRITICAL] Uncaught Exception:", error);
  // Optional: Graceful restart logic could go here
});

async function bootstrap() {
  await connectDatabase();
  startScheduler();

  const server = app.listen(env.port, () => {
    console.log(`API listening on port ${env.port}`);
  });

  server.on("error", (error) => {
    console.error("HTTP server error", error);
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      try {
        await mongoose.connection.close();
      } finally {
        process.exit(0);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  console.error("Failed to boot application", error);
  process.exit(1);
});
