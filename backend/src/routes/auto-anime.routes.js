import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  getAutoAnimeConfig,
  processAutoAnimeSchedule,
  runAutoAnimeNow,
  updateAutoAnimeConfig
} from "../services/anime-automation.service.js";
import { processPendingPosts, processPostNow } from "../services/scheduler.service.js";
import { Post } from "../models/Post.js";

export const autoAnimeRouter = Router();
const RUNTIME_TICK_MIN_GAP_MS = 25000;
let runtimeTickInFlight = false;
let lastRuntimeTickAt = 0;

function getInstantProcessOptions(postType) {
  if (String(postType || "").toLowerCase() === "reel") {
    return { maxAttempts: 8, waitMs: 5000 };
  }

  return { maxAttempts: 4, waitMs: 3500 };
}

autoAnimeRouter.use(authMiddleware);

autoAnimeRouter.get("/", async (_req, res, next) => {
  try {
    const config = await getAutoAnimeConfig();
    return res.json(config);
  } catch (error) {
    return next(error);
  }
});

autoAnimeRouter.patch("/", async (req, res, next) => {
  try {
    const updated = await updateAutoAnimeConfig(req.body || {});
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

autoAnimeRouter.post("/run-now", async (_req, res, next) => {
  try {
    const payload = _req.body || {};

    // Respect unsaved UI selections (for example contentType=post) when user clicks Run Now.
    if (Object.keys(payload).length) {
      await updateAutoAnimeConfig(payload);
    }

    // Run fetch, download, FFMPEG merge, and upload completely in background
    runAutoAnimeNow({ queueDelaySeconds: 0 })
      .then((result) => {
        if (result?.queued && result.postId) {
          processPostNow(
            result.postId,
            getInstantProcessOptions(result.postType)
          ).catch((err) => console.error("Background auto upload error:", err));
        }
      })
      .catch((err) => {
        console.error("runAutoAnimeNow BG failed:", err);
      });

    return res.json({
      queued: true,
      message: "Search & Media generation started in background. Please wait 1-2 minutes and check Queue/History."
    });
  } catch (error) {
    return next(error);
  }
});

autoAnimeRouter.post("/activate-daily", async (req, res, next) => {
  try {
    const payload = req.body || {};
    const mergedPayload = {
      ...payload,
      enabled: true
    };

    const updated = await updateAutoAnimeConfig(mergedPayload);

    // Trigger a tick once so any already-due jobs can execute immediately.
    await processAutoAnimeSchedule();
    await processPendingPosts();

    return res.json({
      activated: true,
      message: "Daily auto scheduler activated. It will post at your saved time slots.",
      config: updated
    });
  } catch (error) {
    return next(error);
  }
});

autoAnimeRouter.post("/tick", async (_req, res, next) => {
  try {
    const now = Date.now();

    if (runtimeTickInFlight) {
      return res.json({ triggered: false, skipped: "in-flight" });
    }

    if (now - lastRuntimeTickAt < RUNTIME_TICK_MIN_GAP_MS) {
      return res.json({ triggered: false, skipped: "throttled" });
    }

    runtimeTickInFlight = true;
    lastRuntimeTickAt = now;

    let autoResult = { triggered: false, reason: "not-run" };

    try {
      autoResult = await processAutoAnimeSchedule();
      await processPendingPosts();
    } finally {
      runtimeTickInFlight = false;
    }

    return res.json({ triggered: true, auto: autoResult });
  } catch (error) {
    runtimeTickInFlight = false;
    return next(error);
  }
});
