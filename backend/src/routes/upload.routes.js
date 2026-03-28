import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { authMiddleware } from "../middleware/auth.js";
import { transcodeToInstagramReelWithMusic } from "../services/music-handler.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("Unsupported file type. Use MP4, MOV, JPG, PNG, or WEBP."));
      return;
    }
    cb(null, true);
  }
});

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
      if (!["http:", "https:"].includes(parsed.protocol)) {
        continue;
      }

      const host = parsed.hostname.toLowerCase();
      // Never generate media URLs on frontend/static hosts because Instagram cannot fetch backend files there.
      if (host.endsWith(".vercel.app") || host.endsWith(".netlify.app")) {
        continue;
      }

      return parsed.origin;
    } catch {
      // Try next candidate.
    }
  }

  return `${req.protocol}://${req.get("host")}`;
}

async function ensureInstagramCompatibleImage(file) {
  if (!file?.mimetype?.startsWith("image/")) {
    return file;
  }

  if (file.mimetype === "image/jpeg") {
    return file;
  }

  const parsed = path.parse(file.filename);
  const convertedFilename = `${parsed.name}.jpg`;
  const convertedPath = path.join(uploadsDir, convertedFilename);

  await sharp(file.path).jpeg({ quality: 90 }).toFile(convertedPath);
  await fs.promises.unlink(file.path);

  return {
    ...file,
    filename: convertedFilename,
    path: convertedPath,
    mimetype: "image/jpeg"
  };
}

async function transcodeToInstagramReel(inputPath, outputPath) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available on server.");
  }

  const hasAudio = await new Promise((resolve, reject) => {
    const probe = spawn(ffmpegPath, [
      "-v",
      "error",
      "-i",
      inputPath,
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

async function ensureInstagramCompatibleVideo(file) {
  if (!file?.mimetype?.startsWith("video/")) {
    return file;
  }

  const parsed = path.parse(file.filename);
  const convertedFilename = `${parsed.name}-ig.mp4`;
  const convertedPath = path.join(uploadsDir, convertedFilename);

  await transcodeToInstagramReel(file.path, convertedPath);
  await fs.promises.unlink(file.path).catch(() => {});

  return {
    ...file,
    filename: convertedFilename,
    path: convertedPath,
    mimetype: "video/mp4"
  };
}

async function ensureInstagramCompatibleMedia(file) {
  if (!file) {
    return file;
  }

  if (file.mimetype?.startsWith("image/")) {
    return ensureInstagramCompatibleImage(file);
  }

  if (file.mimetype?.startsWith("video/")) {
    return ensureInstagramCompatibleVideo(file);
  }

  return file;
}

export const uploadRouter = Router();

uploadRouter.use(authMiddleware);

uploadRouter.post("/media", upload.single("media"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No media file uploaded" });
    }

    const processedFile = await ensureInstagramCompatibleMedia(req.file);
    const mediaUrl = `${getPublicBaseUrl(req)}/media/${processedFile.filename}`;

    return res.status(201).json({
      filename: processedFile.filename,
      mimeType: processedFile.mimetype,
      mediaUrl
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/uploads/video-with-music
 * Upload video file and merge with music in single step
 * Body: multipart with 'video' and optional 'music' files
 */
uploadRouter.post("/video-with-music", upload.fields([
  { name: "video", maxCount: 1 },
  { name: "music", maxCount: 1 }
]), async (req, res, next) => {
  try {
    const videoFile = req.files?.video?.[0];
    const musicFile = req.files?.music?.[0];

    if (!videoFile) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    // If no music provided, just process video as normal
    if (!musicFile) {
      const processedFile = await ensureInstagramCompatibleMedia(videoFile);
      const mediaUrl = `${getPublicBaseUrl(req)}/media/${processedFile.filename}`;

      return res.status(201).json({
        filename: processedFile.filename,
        mimeType: processedFile.mimetype,
        mediaUrl
      });
    }

    // Process both files
    const timestamp = Date.now();
    const outputFilename = `reel-with-music-${timestamp}.mp4`;
    const outputPath = path.join(uploadsDir, outputFilename);

    try {
      await transcodeToInstagramReelWithMusic(
        videoFile.path,
        musicFile.path,
        outputPath,
        {
          audioBlend: req.body.blendMode || "replace",
          musicVolume: parseFloat(req.body.musicVolume) || 1.0,
          videoAudioVolume: parseFloat(req.body.videoAudioVolume) || 0.5
        }
      );

      const mediaUrl = `${getPublicBaseUrl(req)}/media/${outputFilename}`;

      return res.status(201).json({
        filename: outputFilename,
        mimeType: "video/mp4",
        mediaUrl,
        blendMode: req.body.blendMode || "replace",
        message: "Video and music merged successfully"
      });
    } finally {
      // Cleanup temp files
      await fs.promises.unlink(videoFile.path).catch(() => {});
      await fs.promises.unlink(musicFile.path).catch(() => {});
    }
  } catch (error) {
    return next(error);
  }
});

