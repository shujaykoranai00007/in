/**
 * Music Handler Service
 * Implements multiple approaches for adding music to reels:
 * 1. Direct audio muxing
 * 2. YouTube audio extraction
 * 3. Local music file upload
 * 4. Audio track blending
 * 5. Royalty-free music library integration
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");
const musicDir = path.resolve(__dirname, "../../music-library");

// Create directories if they don't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * APPROACH 1: Extract audio track from a video and add to reel
 */
export async function extractAudioFromVideo(sourceVideoUrl) {
  const timestamp = Date.now();
  const inputPath = path.resolve(uploadsDir, `tmp-video-${timestamp}.mp4`);
  const audioOutputPath = path.resolve(musicDir, `extracted-audio-${timestamp}.aac`);

  try {
    // Download the video
    const response = await axios.get(sourceVideoUrl, {
      responseType: "stream",
      timeout: 45000,
      headers: { "User-Agent": "Anime-Scheduler/1.0" }
    });

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(inputPath);
      response.data.pipe(out);
      out.on("finish", resolve);
      out.on("error", reject);
    });

    // Extract audio track
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        "-i",
        inputPath,
        "-q:a",
        "9",
        "-n",
        audioOutputPath
      ]);

      let stderr = "";
      ffmpeg.stderr.on("data", (chunk) => {
        stderr += String(chunk || "");
      });

      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `Audio extraction failed with code ${code}`));
        }
      });
    });

    // Verify audio was extracted
    if (!fs.existsSync(audioOutputPath)) {
      throw new Error("Audio extraction produced no output file");
    }

    return audioOutputPath;
  } finally {
    // Cleanup temp video
    await fs.promises.unlink(inputPath).catch(() => {});
  }
}

/**
 * APPROACH 2: Download audio from YouTube URL using ytdl
 * NOTE: Requires 'ytdl-core' or 'yt-dlp' installation
 */
export async function extractYouTubeAudio(youtubeUrl) {
  const timestamp = Date.now();
  const audioOutputPath = path.resolve(musicDir, `youtube-audio-${timestamp}.aac`);

  try {
    // Using ffmpeg to extract audio from YouTube stream
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        "-i",
        youtubeUrl,
        "-q:a",
        "9",
        "-n",
        audioOutputPath
      ]);

      let stderr = "";
      ffmpeg.stderr.on("data", (chunk) => {
        stderr += String(chunk || "");
      });

      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `YouTube audio extraction failed with code ${code}`));
        }
      });
    });

    return audioOutputPath;
  } catch (error) {
    throw new Error(`Failed to extract audio from YouTube: ${error.message}`);
  }
}

/**
 * APPROACH 3: Merge video with separate audio track
 * Used when:
 * - Video has no audio (silent video)
 * - You want to replace existing audio with new music
 * - You want to blend multiple audio tracks
 */
export async function mergeVideoWithAudio(
  videoPath,
  audioPath,
  outputPath,
  options = {}
) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available");
  }

  const {
    audioVolume = 1.0,
    videoVolume = 0.7,
    audioFilter = "aformat=sample_rates=44100:channel_layouts=stereo",
    blendMode = "mix" // 'mix', 'replace', 'overlay'
  } = options;

  try {
    // Verify files exist
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const args = ["-y", "-i", videoPath, "-i", audioPath];

    // Apply audio filter based on blend mode
    if (blendMode === "overlay") {
      // Overlay audio on top of existing audio
      args.push(
        "-filter_complex",
        `[0:a]volume=${videoVolume}[a0];[1:a]volume=${audioVolume}[a1];[a0][a1]amix=inputs=2:duration=first[a]`,
        "-map",
        "0:v:0",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac"
      );
    } else if (blendMode === "replace") {
      // Replace video audio with new audio completely
      args.push(
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest"
      );
    } else {
      // Default: mix both audios
      args.push(
        "-filter_complex",
        `[0:a]aformat=${audioFilter},volume=${videoVolume}[a0];[1:a]aformat=${audioFilter},volume=${audioVolume}[a1];[a0][a1]amix=inputs=2:duration=first[a]`,
        "-map",
        "0:v:0",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac"
      );
    }

    args.push(outputPath);

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
        } else {
          reject(new Error(stderr || `Audio merge failed with code ${code}`));
        }
      });
    });

    return outputPath;
  } catch (error) {
    throw new Error(`Failed to merge video with audio: ${error.message}`);
  }
}

/**
 * APPROACH 4: Create Instagram reel with music using comprehensive transcoding
 * Handles:
 * - Video format normalization (9:16 aspect ratio)
 * - Audio track preservation or addition
 * - Instagram compliance
 */
export async function transcodeToInstagramReelWithMusic(
  inputVideoPath,
  musicAudioPath,
  outputPath,
  options = {}
) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available");
  }

  const {
    audioBlend = "replace", // 'replace' = only music, 'mix' = blend both
    musicVolume = 1.0,
    videoAudioVolume = 0.5
  } = options;

  try {
    // Check if input video has existing audio
    const hasOriginalAudio = await new Promise((resolve) => {
      const probe = spawn(ffmpegPath, [
        "-v",
        "error",
        "-i",
        inputVideoPath,
        "-map",
        "0:a:0",
        "-f",
        "null",
        "-"
      ]);

      probe.on("close", (code) => {
        resolve(code === 0);
      });
    });

    const args = ["-y"];

    // Add inputs
    args.push("-i", inputVideoPath);

    // Add music if provided
    if (fs.existsSync(musicAudioPath)) {
      args.push("-i", musicAudioPath);
    }

    // Build filter complex based on audio blend mode
    const filters = [];

    if (audioBlend === "replace" || !hasOriginalAudio) {
      // Use only music track
      args.push(
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:a",
        "aac",
        "-b:a",
        "128k"
      );
    } else {
      // Mix original audio and music
      args.push(
        "-filter_complex",
        `[0:a]volume=${videoAudioVolume}[aud0];[1:a]volume=${musicVolume}[aud1];[aud0][aud1]amix=inputs=2:duration=first[aout]`,
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:a",
        "aac",
        "-b:a",
        "196k"
      );
    }

    // Video encoding settings (Instagram native format)
    args.push(
      "-map",
      "0:v:0",
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
      "-b:v",
      "2500k",
      "-maxrate",
      "2500k",
      "-bufsize",
      "5000k",
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
        } else {
          reject(new Error(stderr || `Transcoding failed with code ${code}`));
        }
      });
    });

    return outputPath;
  } catch (error) {
    throw new Error(`Failed to create Instagram reel with music: ${error.message}`);
  }
}

/**
 * APPROACH 5: Royalty-free music library integration
 * Supports services like:
 * - Pixabay Music
 * - Pexels Videos (includes music)
 * - Archive.org audio collection
 */
export async function getFreeMusicTracks(query, libraryApi = "pixabay") {
  const tracks = [];

  try {
    if (libraryApi === "pixabay" && process.env.PIXABAY_API_KEY) {
      // Pixabay Music API
      const response = await axios.get("https://pixabay.com/api/videos/", {
        params: {
          q: query,
          key: process.env.PIXABAY_API_KEY,
          per_page: 5
        },
        timeout: 10000
      });

      return response.data.hits.map((hit) => ({
        id: hit.id,
        title: query,
        duration: hit.duration,
        url: hit.videos.medium.url,
        source: "pixabay",
        type: "background-track"
      }));
    }

    if (libraryApi === "archive" && process.env.ARCHIVE_ORG_API_KEY) {
      // Internet Archive audio collection
      const response = await axios.get(
        "https://archive.org/advancedsearch.php",
        {
          params: {
            q: `(${query}) AND mediatype:audio AND format:(MP3 OR OGG)`,
            fl: ["identifier", "title"],
            output: "json",
            rows: 5
          },
          timeout: 10000
        }
      );

      return response.data.response.docs.map((doc) => ({
        id: doc.identifier,
        title: doc.title,
        url: `https://archive.org/download/${doc.identifier}/${doc.identifier}_64kb.mp3`,
        source: "archive.org",
        type: "free-music"
      }));
    }

    // Default: return anime/gaming music-related tracks
    return [
      {
        id: "anime-default",
        title: "Anime Background Music - Epic",
        url: null,
        source: "builtin",
        type: "placeholder"
      }
    ];
  } catch (error) {
    console.error(`Music library fetch error (${libraryApi}):`, error.message);
    return [];
  }
}

/**
 * APPROACH 6: Smart audio profile detection and enhancement
 * Analyzes video and automatically chooses best audio handling strategy
 */
export async function analyzeVideoForMusic(videoPath) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available");
  }

  return new Promise((resolve, reject) => {
    const ffprobe = spawn(ffmpegPath, [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      videoPath
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("Failed to analyze video"));
        return;
      }

      try {
        const data = JSON.parse(output);
        const audioStream = data.streams.find((s) => s.codec_type === "audio");
        const videoStream = data.streams.find((s) => s.codec_type === "video");

        resolve({
          hasAudio: !!audioStream,
          hasVideo: !!videoStream,
          duration: Number(data.format.duration || 0),
          audioCodec: audioStream?.codec_name || null,
          videoDimensions: videoStream
            ? {
                width: videoStream.width,
                height: videoStream.height,
                duration: Number(videoStream.duration || 0)
              }
            : null,
          recommendation: audioStream
            ? "merge" // Has audio, can blend with music
            : "replace" // No audio, replace with music
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Clean up old music files (older than 24 hours)
 */
export async function cleanupOldMusicFiles() {
  const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const files = await fs.promises.readdir(musicDir);

    for (const file of files) {
      const filePath = path.join(musicDir, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.mtimeMs < cutoffTime) {
        await fs.promises.unlink(filePath);
        console.log(`[Music] Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error("[Music] Cleanup error:", error.message);
  }
}
