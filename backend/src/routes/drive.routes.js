import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { listMediaFiles } from "../services/google-drive.service.js";

export const driveRouter = Router();

driveRouter.use(authMiddleware);

driveRouter.get("/media", async (req, res, next) => {
  try {
    const postType = req.query.postType;
    if (!postType || !["reel", "post"].includes(postType)) {
      return res.status(400).json({ message: "postType must be reel or post" });
    }

    const files = await listMediaFiles(postType);
    return res.json(files);
  } catch (error) {
    return next(error);
  }
});
