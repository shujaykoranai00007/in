/**
 * Music Routes
 * Handles music upload, extraction, and library search
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import { fileURLToPath } from "url";
import { authMiddleware } from "../middleware/auth.js";
import {
  extractAudioFromVideo,
  extractYouTubeAudio,
  mergeVideoWithAudio,
  getFreeMusicTracks,
  analyzeVideoForMusic,
  transcodeToInstagramReelWithMusic
} from "../services/music-handler.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const musicDir = path.resolve(__dirname, "../../music-library");
const uploadsDir = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

export const musicRouter = Router();

// Multer config for music uploads
const audioMimeTypes = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
  "audio/mp4",
  "audio/webm",
  "audio/ogg"
]);

const musicStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, musicDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `music-${timestamp}${ext}`);
  }
});

const musicUpload = multer({
  storage: musicStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for audio
  fileFilter: (_req, file, cb) => {
    if (!audioMimeTypes.has(file.mimetype)) {
      cb(new Error("Unsupported audio format. Use MP3, WAV, AAC, OGG, or WebM."));
      return;
    }
    cb(null, true);
  }
});

musicRouter.use(authMiddleware);

/**
 * POST /api/music/upload
 * Upload audio file directly
 * Returns: { musicId, filename, duration, url }
 */
musicRouter.post("/upload", musicUpload.single("audioFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No audio file provided" });
    }

    const musicUrl = `/music-library/${req.file.filename}`;

    return res.json({
      musicId: req.file.filename,
      filename: req.file.originalname,
      size: req.file.size,
      url: musicUrl,
      path: req.file.path
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/music/extract-from-video
 * Extract audio track from video URL
 * Body: { videoUrl }
 * Returns: { audioPath, filename }
 */
musicRouter.post("/extract-from-video", async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ message: "videoUrl is required" });
    }

    const audioPath = await extractAudioFromVideo(videoUrl);
    const filename = path.basename(audioPath);

    return res.json({
      audioPath,
      filename,
      url: `/music-library/${filename}`,
      source: "video-extraction"
    });
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

/**
 * POST /api/music/extract-youtube
 * Extract audio from YouTube URL
 * Body: { youtubeUrl }
 * Returns: { audioPath, filename, duration }
 */
musicRouter.post("/extract-youtube", async (req, res) => {
  try {
    const { youtubeUrl } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ message: "youtubeUrl is required" });
    }

    // Validate YouTube URL
    if (!youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be")) {
      return res.status(400).json({ message: "Invalid YouTube URL" });
    }

    const audioPath = await extractYouTubeAudio(youtubeUrl);
    const filename = path.basename(audioPath);

    return res.json({
      audioPath,
      filename,
      url: `/music-library/${filename}`,
      source: "youtube",
      note: "YouTube audio extraction - use music you have rights to"
    });
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

/**
 * GET /api/music/search
 * Search free/royalty-free music libraries
 * Query: { q: "search query", library: "pixabay|archive|builtin" }
 * Returns: [{ id, title, url, source }]
 */
musicRouter.get("/search", async (req, res) => {
  try {
    const { q, library = "pixabay" } = req.query;

    if (!q) {
      return res.status(400).json({ message: "Search query required" });
    }

    const tracks = await getFreeMusicTracks(q, library);
    return res.json(tracks);
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

/**
 * POST /api/music/analyze-video
 * Analyze video to determine best audio strategy
 * Body: { videoUrl }
 * Returns: { hasAudio, duration, recommendation }
 */
musicRouter.post("/analyze-video", async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ message: "videoUrl is required" });
    }

    // For remote URLs, download first
    const timestamp = Date.now();
    const tempVideoPath = path.resolve(
      uploadsDir,
      `temp-analysis-${timestamp}.mp4`
    );

    try {
      const response = await axios.get(videoUrl, {
        responseType: "stream",
        timeout: 45000
      });

      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(tempVideoPath);
        response.data.pipe(out);
        out.on("finish", resolve);
        out.on("error", reject);
      });

      const analysis = await analyzeVideoForMusic(tempVideoPath);
      return res.json(analysis);
    } finally {
      await fs.promises.unlink(tempVideoPath).catch(() => {});
    }
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

/**
 * POST /api/music/merge
 * Merge video with audio track
 * Body: {
 *   videoUrl: "url to video",
 *   musicUrl: "url to music or /music-library/filename",
 *   blendMode: "replace|mix|overlay",
 *   musicVolume: 1.0,
 *   videoAudioVolume: 0.5
 * }
 * Returns: { outputUrl, filename }
 */
musicRouter.post("/merge", async (req, res) => {
  try {
    const {
      videoUrl,
      musicUrl,
      blendMode = "replace",
      musicVolume = 1.0,
      videoAudioVolume = 0.5
    } = req.body;

    if (!videoUrl || !musicUrl) {
      return res
        .status(400)
        .json({ message: "videoUrl and musicUrl are required" });
    }

    const timestamp = Date.now();
    const tempVideoPath = path.resolve(
      uploadsDir,
      `temp-video-${timestamp}.mp4`
    );
    const tempMusicPath = path.resolve(
      uploadsDir,
      `temp-music-${timestamp}.aac`
    );
    const outputFilename = `merged-reel-${timestamp}.mp4`;
    const outputPath = path.resolve(uploadsDir, outputFilename);

    try {
      // Download video
      const videoResponse = await axios.get(videoUrl, {
        responseType: "stream",
        timeout: 45000
      });

      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(tempVideoPath);
        videoResponse.data.pipe(out);
        out.on("finish", resolve);
        out.on("error", reject);
      });

      // Get music (could be URL or local file)
      let musicPath;
      if (musicUrl.startsWith("/music-library/")) {
        musicPath = path.resolve(
          musicDir,
          path.basename(musicUrl)
        );
      } else {
        const musicResponse = await axios.get(musicUrl, {
          responseType: "stream",
          timeout: 30000
        });

        await new Promise((resolve, reject) => {
          const out = fs.createWriteStream(tempMusicPath);
          musicResponse.data.pipe(out);
          out.on("finish", resolve);
          out.on("error", reject);
        });

        musicPath = tempMusicPath;
      }

      // Merge video and audio
      await transcodeToInstagramReelWithMusic(tempVideoPath, musicPath, outputPath, {
        audioBlend: blendMode,
        musicVolume,
        videoAudioVolume
      });

      return res.json({
        success: true,
        outputUrl: `/media/${outputFilename}`,
        filename: outputFilename,
        blendMode,
        message: "Reel created with music successfully"
      });
    } finally {
      // Cleanup temp files
      await fs.promises.unlink(tempVideoPath).catch(() => {});
      await fs.promises.unlink(tempMusicPath).catch(() => {});
    }
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

/**
 * GET /api/music/library
 * Get list of uploaded music files in library
 * Returns: [{ filename, size, uploadedAt, url }]
 */
musicRouter.get("/library", async (req, res) => {
  try {
    const files = await fs.promises.readdir(musicDir);
    const musicList = [];

    for (const filename of files) {
      const filePath = path.join(musicDir, filename);
      const stats = await fs.promises.stat(filePath);

      musicList.push({
        filename,
        size: stats.size,
        uploadedAt: stats.mtime,
        url: `/music-library/${filename}`
      });
    }

    return res.json(musicList);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/music/library/:filename
 * Delete music file from library
 */
musicRouter.delete("/library/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: prevent directory traversal
    if (filename.includes("../") || filename.includes("..\\")) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    const filePath = path.join(musicDir, filename);

    // Verify file is in music directory
    const realPath = await fs.promises.realpath(filePath);
    if (!realPath.startsWith(await fs.promises.realpath(musicDir))) {
      return res.status(400).json({ message: "Invalid file path" });
    }

    await fs.promises.unlink(filePath);

    return res.json({ success: true, message: "Music file deleted" });
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ message: "File not found" });
    }
    return res.status(500).json({ message: error.message });
  }
});
