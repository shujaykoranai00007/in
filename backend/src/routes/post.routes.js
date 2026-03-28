import { Router } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { authMiddleware } from "../middleware/auth.js";
import { Post } from "../models/Post.js";
import { generateUploadText } from "../services/caption-suggest.service.js";
import { extractMediaFromUrl } from "../services/media-extract.service.js";
import { processPendingPosts, processPostNow } from "../services/scheduler.service.js";
import { cleanupPostLocalMedia } from "../services/media-cleanup.service.js";

export const postRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function getPublicBaseUrl(req) {
  const candidates = [
    process.env.RENDER_EXTERNAL_URL,
    process.env.PUBLIC_BASE_URL,
    req.get("x-forwarded-host")
      ? `${req.get("x-forwarded-proto") || req.protocol}://${req.get("x-forwarded-host")}`
      : "",
    `${req.protocol}://${req.get("host")}`
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) {
      continue;
    }

    try {
      const parsed = new URL(value);
      if (["http:", "https:"].includes(parsed.protocol)) {
        const host = parsed.hostname.toLowerCase();
        if (host.endsWith(".vercel.app") || host.endsWith(".netlify.app")) {
          continue;
        }

        return parsed.origin;
      }
    } catch {
      // Try next candidate.
    }
  }

  return `${req.protocol}://${req.get("host")}`;
}

function extensionFromUrl(url, fallback = ".bin") {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname || "").toLowerCase();
    if (ext && ext.length <= 8) {
      return ext;
    }
  } catch {
    // Ignore parsing errors and use fallback extension.
  }

  return fallback;
}

function looksLikeVideoUrl(url = "") {
  const value = String(url || "").toLowerCase();
  return value.includes(".mp4") || value.includes("video") || value.includes("/reel/");
}

function isImageInsteadOfReelError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("resolved to an image post") || msg.includes("not a reel video");
}

function getInstantProcessOptions(postType) {
  if (String(postType || "").toLowerCase() === "reel") {
    // Reels often need longer processing time on Instagram before publish can succeed.
    return { maxAttempts: 8, waitMs: 5000 };
  }

  return { maxAttempts: 4, waitMs: 3500 };
}

async function extractMediaWithTypeFallback(sourceUrl, requestedPostType) {
  const wantsReel = String(requestedPostType || "").toLowerCase() === "reel";

  try {
    const extracted = await extractMediaFromUrl(sourceUrl, { preferVideo: wantsReel });
    return {
      extracted,
      postType: wantsReel ? "reel" : extracted?.postType === "post" ? "post" : "reel"
    };
  } catch (error) {
    if (!wantsReel || !isImageInsteadOfReelError(error)) {
      throw error;
    }

    // Graceful fallback: if URL resolves to image content, continue as image post.
    const extracted = await extractMediaFromUrl(sourceUrl, { preferVideo: false });
    return {
      extracted,
      postType: extracted?.postType === "post" ? "post" : "reel"
    };
  }
}

async function hasVideoTrack(filePath) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available on server.");
  }

  return new Promise((resolve, reject) => {
    const probe = spawn(ffmpegPath, [
      "-v",
      "error",
      "-i",
      filePath,
      "-map",
      "0:v:0",
      "-f",
      "null",
      "-"
    ]);

    probe.on("error", reject);
    probe.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

async function hasAudioTrack(filePath) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available on server.");
  }

  return new Promise((resolve, reject) => {
    const probe = spawn(ffmpegPath, [
      "-v",
      "error",
      "-i",
      filePath,
      "-map",
      "0:a:0",
      "-f",
      "null",
      "-"
    ]);

    probe.on("error", reject);
    probe.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

async function transcodeLinkedReelToInstagram(inputPath, outputPath) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available on server.");
  }

  const hasVideo = await hasVideoTrack(inputPath);
  if (!hasVideo) {
    throw new Error("Selected Instagram URL does not contain a reel video stream.");
  }

  const hasAudio = await hasAudioTrack(inputPath);

  const args = [
    "-y",
    "-i",
    inputPath
  ];

  if (!hasAudio) {
    args.push(
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=stereo"
    );
  }

  args.push(
    "-map",
    "0:v:0",
    "-map",
    hasAudio ? "0:a:0" : "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-level:v",
    "4.0",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p",
    "-r",
    "30",
    "-g",
    "60",
    "-keyint_min",
    "60",
    "-sc_threshold",
    "0",
    "-b:v",
    "2500k",
    "-maxrate",
    "2500k",
    "-bufsize",
    "5000k",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-max_muxing_queue_size",
    "1024",
    "-shortest",
    outputPath
  );

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args);

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg failed with code ${code}`));
    });
  });
}

async function downloadUrlToFile(url, filePath) {
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 90000,
    maxContentLength: 500 * 1024 * 1024,
    headers: {
      "User-Agent": "InstaFlowScheduler/1.0"
    }
  });

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(filePath);
    response.data.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
  });
}

async function downloadAndPrepareLinkedMedia(sourceMediaUrl, postType) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fallbackExt = postType === "reel" ? ".mp4" : ".jpg";
  const sourceExt = extensionFromUrl(sourceMediaUrl, fallbackExt);
  const tempFilename = `link-source-${token}${sourceExt}`;
  const tempPath = path.resolve(uploadsDir, tempFilename);

  await downloadUrlToFile(sourceMediaUrl, tempPath);

  if (postType === "post") {
    const finalFilename = `link-image-${token}.jpg`;
    const finalPath = path.resolve(uploadsDir, finalFilename);
    await sharp(tempPath).jpeg({ quality: 90 }).toFile(finalPath);
    await fs.promises.unlink(tempPath).catch(() => {});
    return { finalFilename, finalPath };
  }

  const finalFilename = `link-reel-${token}.mp4`;
  const finalPath = path.resolve(uploadsDir, finalFilename);
  await transcodeLinkedReelToInstagram(tempPath, finalPath);
  await fs.promises.unlink(tempPath).catch(() => {});

  return { finalFilename, finalPath };
}

postRouter.use(authMiddleware);

// Extract media URL and type from an Instagram post/reel URL.
// Must be registered before /:id to avoid route conflicts.
postRouter.post("/extract-url", async (req, res, next) => {
  try {
    const { sourceUrl, postType: requestedPostType } = req.body;
    if (!sourceUrl) {
      return res.status(400).json({ message: "sourceUrl is required" });
    }

    const { extracted } = await extractMediaWithTypeFallback(sourceUrl, requestedPostType);
    const result = extracted;
    return res.json(result);
  } catch (error) {
    return res.status(422).json({
      message: error?.message || "Could not extract media from this Instagram URL"
    });
  }
});

postRouter.post("/from-link/auto", async (req, res, next) => {
  try {
    const { sourceUrl, caption, postType: requestedPostType } = req.body || {};
    if (!sourceUrl) {
      return res.status(400).json({ message: "sourceUrl is required" });
    }

    const { extracted, postType } = await extractMediaWithTypeFallback(sourceUrl, requestedPostType);
    if (!extracted?.mediaUrl) {
      return res.status(422).json({
        message: "Could not extract downloadable media from this URL. Try Upload File for guaranteed results."
      });
    }

    if (postType === "reel" && !looksLikeVideoUrl(extracted.mediaUrl)) {
      return res.status(422).json({
        message: "Reel mode requires a real video source URL. This link resolved to image content."
      });
    }

    const { finalFilename, finalPath } = await downloadAndPrepareLinkedMedia(extracted.mediaUrl, postType);
    const mediaUrl = `${getPublicBaseUrl(req)}/media/${finalFilename}`;

    const created = await Post.create({
      mediaUrl,
      caption: String(caption || extracted.caption || "").trim(),
      postType,
      scheduledTime: new Date(),
      status: "pending",
      sourcePlatform: "manual",
      sourceUrl,
      localMediaPath: finalPath,
      isTemporaryMedia: true
    });

    // Trigger immediate processing for this exact post.
    // If this step fails, keep the post queued and return a non-fatal warning.
    let processingWarning = "";
    let instantProcess = null;
    try {
      instantProcess = await processPostNow(created._id, getInstantProcessOptions(created.postType));

      // Fallback: if lock contention prevented immediate processing, kick the queue worker once.
      if (!instantProcess?.processed && instantProcess?.status === "pending") {
        await processPendingPosts();
      }
    } catch (processingError) {
      processingWarning =
        processingError?.message ||
        "Auto processing did not start immediately. Post is queued and scheduler will retry shortly.";
    }

    const latest = await Post.findById(created._id).lean();
    return res.status(201).json({
      message: processingWarning
        ? `Link downloaded. ${processingWarning}`
        : "Link downloaded and auto post triggered.",
      post: latest || created,
      instantProcess
    });
  } catch (error) {
    const fallbackMessage =
      error?.message ||
      "Could not auto-post from this link. Instagram may block extraction for this URL.";

    return res.status(422).json({ message: fallbackMessage });
  }
});

postRouter.post("/from-link/schedule", async (req, res, next) => {
  try {
    const { sourceUrl, caption, scheduledTime, keywords, hashtags, postType: requestedPostType } = req.body || {};
    if (!sourceUrl) {
      return res.status(400).json({ message: "sourceUrl is required" });
    }

    if (!scheduledTime) {
      return res.status(400).json({ message: "scheduledTime is required" });
    }

    const parsedSchedule = new Date(scheduledTime);
    if (Number.isNaN(parsedSchedule.getTime())) {
      return res.status(400).json({ message: "scheduledTime must be a valid datetime" });
    }

    const { extracted, postType } = await extractMediaWithTypeFallback(sourceUrl, requestedPostType);
    if (!extracted?.mediaUrl) {
      return res.status(422).json({
        message: "Could not extract downloadable media from this URL. Try Upload File for guaranteed results."
      });
    }

    if (postType === "reel" && !looksLikeVideoUrl(extracted.mediaUrl)) {
      return res.status(422).json({
        message: "Reel mode requires a real video source URL. This link resolved to image content."
      });
    }

    const { finalFilename, finalPath } = await downloadAndPrepareLinkedMedia(extracted.mediaUrl, postType);
    const mediaUrl = `${getPublicBaseUrl(req)}/media/${finalFilename}`;

    const created = await Post.create({
      mediaUrl,
      caption: String(caption || extracted.caption || "").trim(),
      keywords: Array.isArray(keywords) ? keywords : [],
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      postType,
      scheduledTime: parsedSchedule,
      status: "pending",
      sourcePlatform: "manual",
      sourceUrl,
      localMediaPath: finalPath,
      isTemporaryMedia: true
    });

    return res.status(201).json({
      message: "Link downloaded and scheduled successfully.",
      post: created
    });
  } catch (error) {
    const fallbackMessage =
      error?.message ||
      "Could not schedule from this link. Instagram may block extraction for this URL.";

    return res.status(422).json({ message: fallbackMessage });
  }
});

postRouter.post("/generate-upload-text", async (req, res, next) => {
  try {
    const { seedText, existingCaption, postType } = req.body || {};
    if (!postType || !["reel", "post"].includes(postType)) {
      return res.status(400).json({ message: "postType must be reel or post" });
    }

    const generated = generateUploadText({
      seedText: seedText || "anime edit",
      existingCaption,
      postType
    });

    return res.json(generated);
  } catch (error) {
    return next(error);
  }
});

postRouter.post("/", async (req, res, next) => {
  try {
    const { mediaUrl, caption, postType, scheduledTime, driveFileId, keywords, hashtags } = req.body;

    if (!mediaUrl || !postType || !scheduledTime) {
      return res
        .status(400)
        .json({ message: "mediaUrl, postType and scheduledTime are required" });
    }

    if (!["reel", "post"].includes(postType)) {
      return res.status(400).json({ message: "postType must be reel or post" });
    }

    try {
      new URL(mediaUrl);
    } catch {
      return res.status(400).json({ message: "mediaUrl must be a valid URL" });
    }

    const parsedSchedule = new Date(scheduledTime);
    if (Number.isNaN(parsedSchedule.getTime())) {
      return res.status(400).json({ message: "scheduledTime must be a valid datetime" });
    }

    const post = await Post.create({
      mediaUrl,
      caption,
      keywords: Array.isArray(keywords) ? keywords : [],
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      postType,
      scheduledTime: parsedSchedule,
      driveFileId,
      status: "pending"
    });

    // If user schedules for now/past (or near-now), attempt immediate publish.
    const shouldProcessNow = parsedSchedule.getTime() <= Date.now() + 15 * 1000;
    if (!shouldProcessNow) {
      return res.status(201).json(post);
    }

    let instantProcess = null;
    try {
      instantProcess = await processPostNow(post._id, getInstantProcessOptions(post.postType));
    } catch {
      // Keep post queued if immediate processing throws.
    }

    const latest = await Post.findById(post._id).lean();
    return res.status(201).json({
      ...(latest || post),
      instantProcess
    });
  } catch (error) {
    return next(error);
  }
});

postRouter.get("/", async (req, res, next) => {
  try {
    const { status, limit } = req.query;
    const statuses = String(status || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const filter = statuses.length
      ? {
          status: statuses.length === 1 ? statuses[0] : { $in: statuses }
        }
      : {};

    const maxLimit = Math.min(Number(limit) || 100, 200);
    const posts = await Post.find(filter).sort({ scheduledTime: 1 }).limit(maxLimit).lean();
    return res.json(posts);
  } catch (error) {
    return next(error);
  }
});

postRouter.get("/history", async (_req, res, next) => {
  try {
    const posts = await Post.find({ status: { $in: ["pending", "processing", "posted", "failed"] } }).sort({
      updatedAt: -1
    }).limit(200).lean();
    return res.json(posts);
  } catch (error) {
    return next(error);
  }
});

postRouter.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedUpdates = ["caption", "scheduledTime", "status", "mediaUrl", "postType"];

    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedUpdates.includes(key))
    );

    const post = await Post.findOneAndUpdate(
      { _id: id, status: { $in: ["pending", "failed"] } },
      { $set: updates },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found or cannot be edited" });
    }

    return res.json(post);
  } catch (error) {
    return next(error);
  }
});

postRouter.delete("/:id", async (req, res, next) => {
  try {
    const candidate = await Post.findOne({
      _id: req.params.id,
      status: { $in: ["pending", "processing", "posted", "failed"] }
    });

    if (!candidate) {
      return res.status(404).json({ message: "Post not found or cannot be deleted" });
    }

    try {
      await cleanupPostLocalMedia(candidate);
    } catch (cleanupError) {
      console.error("Failed to remove local media while deleting post", candidate._id, cleanupError);
    }

    await Post.deleteOne({ _id: candidate._id });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

postRouter.delete("/:id/local-media", async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.status === "processing") {
      return res.status(409).json({
        message: "Cannot delete local media while post is processing"
      });
    }

    const cleanup = await cleanupPostLocalMedia(post);
    await Post.updateOne(
      { _id: post._id },
      {
        $set: {
          localMediaPath: null,
          isTemporaryMedia: false,
          localMediaDeletedAt: new Date()
        }
      }
    );

    return res.json({
      removed: cleanup.removed,
      bytesFreed: cleanup.bytesFreed,
      message: cleanup.removed
        ? "Local media deleted"
        : "No local media file found"
    });
  } catch (error) {
    return next(error);
  }
});
