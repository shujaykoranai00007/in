import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  getAutoAnimeConfig,
  runAutoAnimeNow,
  updateAutoAnimeConfig
} from "../services/anime-automation.service.js";

export const autoAnimeRouter = Router();

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

    const result = await runAutoAnimeNow();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
