import { AutoAnimeConfig } from "../models/AutoAnimeConfig.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import { Post } from "../models/Post.js";
import { fileURLToPath } from "url";
import { getRedditAnimeCandidates } from "./anime-fetch.service.js";

const SLOT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_SLOTS = ["09:00", "12:30", "18:00"];
const MAX_RECENT_SOURCE_IDS = 300;
const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "edit",
  "anime",
  "amv",
  "mmv",
  "gmv",
  "reel",
  "video",
  "short",
  "shorts",
  "official",
  "best",
  "new",
  "hd",
  "4k",
  "1080p"
]);
const MAX_CAPTION_LENGTH = 2200;
const AUTO_REEL_MAX_SECONDS = 40;
const FALLBACK_SUBREDDITS = ["Animeedits", "AnimeMusicVideos", "anime_edits", "anime"];
const DEFAULT_HASHTAG_SETS = [
  "#AnimeEdit #AnimeReels #AMV #EditCommunity #ReelsInstagram #ExplorePage",
  "#AnimeLovers #AnimeClips #OtakuVibes #TrendingReels #ViralEdits #ForYou",
  "#AnimeScene #AnimeMoments #WatchTillEnd #SaveAndShare #AnimeDaily #FanEdit"
];
const DEFAULT_KEYWORD_SETS = [
  "anime edit, anime reels, amv edit, otaku vibes, trending anime",
  "anime moments, best anime scene, fan edit, anime community, viral anime edit",
  "cinematic anime edit, emotional anime clip, anime lovers, anime shorts, anime aesthetic"
];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function uniqueSortedSlots(slots = []) {
  return [...new Set(slots)]
    .filter((slot) => SLOT_PATTERN.test(slot))
    .sort();
}

function normalizeList(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function formatDateParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${byType.year}-${byType.month}-${byType.day}`,
    timeKey: `${byType.hour}:${byType.minute}`
  };
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^\)]*\)/g, " ")
    .replace(/[|_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toHashtagToken(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((piece) => piece[0].toUpperCase() + piece.slice(1).toLowerCase())
    .join("");
}

function extractTopicTokens(title) {
  const words = cleanTitle(title)
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  return [...new Set(words)].slice(0, 4);
}

function buildDynamicKeywordString(candidate) {
  const tokens = extractTopicTokens(candidate.title)
    .map((token) => token.replace(/[^a-z0-9]/g, " ").trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!tokens.length) {
    return "anime edit, anime reels, amv edit";
  }

  return tokens
    .map((token) => (token.includes("anime") ? token : `anime ${token}`))
    .join(", ");
}

function inferAnimeLabel(title) {
  const cleaned = cleanTitle(title);
  if (!cleaned) {
    return "This anime";
  }

  const parts = cleaned.split(/[-:]/).map((part) => part.trim()).filter(Boolean);
  const primary = parts[0] || cleaned;
  const words = primary.split(/\s+/).slice(0, 4);
  const label = words.join(" ").trim();
  return label || "This anime";
}

function buildSmartCaption(candidate) {
  const title = cleanTitle(candidate.title) || "Anime edit";
  const animeLabel = inferAnimeLabel(title);
  const tokens = extractTopicTokens(title);

  const nicheTags = tokens
    .map((token) => `#${toHashtagToken(token)}`)
    .filter((tag) => tag.length > 2)
    .slice(0, 4);

  const coreTags = candidate.postType === "post"
    ? ["#AnimeEdit", "#AnimePost", "#AnimeLovers", "#OtakuCommunity", "#ExplorePage", "#SaveAndShare"]
    : ["#AnimeEdit", "#AnimeReels", "#AMV", "#EditCommunity", "#ReelsInstagram", "#ExplorePage"];

  const uniqueTags = [...new Set([...nicheTags, ...coreTags])].slice(0, 10);

  const contentLabel = candidate.postType === "post" ? "post" : "reel";
  const lines = [
    `${animeLabel} energy in one ${contentLabel}.`,
    `Rate this edit from 1-10 and comment your favorite scene.`,
    `Save and share with an anime friend for more daily drops.`,
    "",
    uniqueTags.join(" ")
  ];

  return lines.join("\n").slice(0, MAX_CAPTION_LENGTH);
}

function sanitizeHashtagSets(rawSets = []) {
  const normalized = normalizeList(rawSets)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  return normalized.length ? normalized : DEFAULT_HASHTAG_SETS;
}

function sanitizeKeywordSets(rawSets = []) {
  const normalized = normalizeList(rawSets)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  return normalized.length ? normalized : DEFAULT_KEYWORD_SETS;
}

function pickRotatingHashtagSet(config) {
  const sets = sanitizeHashtagSets(config.hashtagSets);
  const cursor = Number(config.hashtagSetCursor || 0);
  const index = cursor >= 0 ? cursor % sets.length : 0;
  return {
    text: sets[index],
    nextCursor: (index + 1) % sets.length,
    sets
  };
}

function pickRotatingKeywordSet(config) {
  const sets = sanitizeKeywordSets(config.keywordSets);
  const cursor = Number(config.keywordSetCursor || 0);
  const index = cursor >= 0 ? cursor % sets.length : 0;
  return {
    text: sets[index],
    nextCursor: (index + 1) % sets.length,
    sets
  };
}

function renderCaption(template, candidate, rotatingHashtagText = "", rotatingKeywordText = "") {
  const safeTemplate = (template || "").trim();
  const smartCaption = buildSmartCaption(candidate);
  const dynamicKeywords = buildDynamicKeywordString(candidate);
  const mergedKeywords = [rotatingKeywordText, dynamicKeywords]
    .filter(Boolean)
    .join(", ");
  const keywordLine = mergedKeywords ? `Keywords: ${mergedKeywords}` : "";

  if (!safeTemplate) {
    if (!rotatingHashtagText) {
      return keywordLine ? `${smartCaption}\n${keywordLine}`.slice(0, MAX_CAPTION_LENGTH) : smartCaption;
    }

    const lines = smartCaption.split("\n");
    lines[lines.length - 1] = rotatingHashtagText;
    const withTags = lines.join("\n");
    return keywordLine ? `${withTags}\n${keywordLine}`.slice(0, MAX_CAPTION_LENGTH) : withTags;
  }

  const custom = safeTemplate
    .replaceAll("{{title}}", candidate.title)
    .replaceAll("{{anime}}", inferAnimeLabel(candidate.title))
    .replaceAll("{{subreddit}}", candidate.subreddit)
    .replaceAll("{{sourceUrl}}", candidate.sourceUrl);

  // Keep custom templates but append optimized tags if user forgot hashtags.
  if (!/#\w+/.test(custom)) {
    const fallbackTags = rotatingHashtagText || smartCaption.split("\n").at(-1);
    const withTags = `${custom}\n\n${fallbackTags}`;
    return keywordLine ? `${withTags}\n${keywordLine}`.slice(0, MAX_CAPTION_LENGTH) : withTags.slice(0, MAX_CAPTION_LENGTH);
  }

  return keywordLine ? `${custom}\n${keywordLine}`.slice(0, MAX_CAPTION_LENGTH) : custom.slice(0, MAX_CAPTION_LENGTH);
}

function getPublicBaseUrl() {
  const candidates = [process.env.RENDER_EXTERNAL_URL, process.env.PUBLIC_BASE_URL];

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

      return parsed.origin;
    } catch {
      // Try next candidate.
    }
  }

  return `http://localhost:${process.env.PORT || 5000}`;
}

function hasUsablePublicBaseUrl() {
  const value = getPublicBaseUrl();
  if (!value || value.includes("localhost")) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      return false;
    }


    if (host.startsWith("10.") || host.startsWith("192.168.")) {
      return false;
    }

    if (host.startsWith("172.")) {
      const secondOctet = Number(host.split(".")[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return false;
      }
    }

    // Frontend-only hosts typically do not expose backend media files.
    if (host.endsWith(".vercel.app") || host.endsWith(".netlify.app")) {
      return false;
    }

    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function isMediaUrlReachable(url) {
  try {
    const response = await axios.head(url, {
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "InstaFlowScheduler/1.0"
      }
    });

    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

function inferImageExtension(contentType, mediaUrl) {
  const normalizedType = String(contentType || "").toLowerCase();
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) {
    return "jpg";
  }

  if (normalizedType.includes("png")) {
    return "png";
  }

  const pathname = (() => {
    try {
      return new URL(mediaUrl).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (pathname.endsWith(".png")) {
    return "png";
  }

  return "jpg";
}

function resolveUrl(baseUrl, childUrl) {
  try {
    return new URL(childUrl, baseUrl).toString();
  } catch {
    return "";
  }
}

function deriveDashUrlFromReelUrl(mediaUrl) {
  try {
    const parsed = new URL(mediaUrl);
    if (parsed.hostname.toLowerCase() !== "v.redd.it") {
      return "";
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (!segments.length) {
      return "";
    }

    const clipId = segments[0];
    return `${parsed.protocol}//${parsed.host}/${clipId}/DASHPlaylist.mpd`;
  } catch {
    return "";
  }
}

async function downloadToFile(url, outputPath) {
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 45000,
    maxContentLength: 250 * 1024 * 1024,
    headers: {
      "User-Agent": "InstaFlowScheduler/1.0"
    }
  });

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(outputPath);
    response.data.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
  });
}

async function pickDashAudioUrl(dashUrl) {
  if (!dashUrl) {
    return "";
  }

  try {
    const { data } = await axios.get(dashUrl, {
      timeout: 15000,
      responseType: "text",
      headers: {
        "User-Agent": "InstaFlowScheduler/1.0"
      }
    });

    const xml = String(data || "");
    const allAudioUrls = [];
    const adaptationBlocks = [...xml.matchAll(/<AdaptationSet[\s\S]*?<\/AdaptationSet>/gi)];

    for (const blockMatch of adaptationBlocks) {
      const block = blockMatch[0] || "";
      const isAudioSet =
        /mimeType="audio\//i.test(block) ||
        /contentType="audio"/i.test(block) ||
        /audioSamplingRate=/i.test(block) ||
        /codecs="[^"]*mp4a/i.test(block);

      if (!isAudioSet) {
        continue;
      }

      const baseUrlMatches = [...block.matchAll(/<BaseURL>([^<]+)<\/BaseURL>/gi)];
      for (const item of baseUrlMatches) {
        const candidate = resolveUrl(dashUrl, String(item[1] || "").trim());
        if (candidate) {
          allAudioUrls.push(candidate);
        }
      }

      const representationBlocks = [...block.matchAll(/<Representation[\s\S]*?<\/Representation>/gi)];
      for (const repMatch of representationBlocks) {
        const rep = repMatch[0] || "";
        const repAudio = /audioSamplingRate=/i.test(rep) || /codecs="[^"]*mp4a/i.test(rep);
        if (!repAudio) {
          continue;
        }

        const repUrlMatches = [...rep.matchAll(/<BaseURL>([^<]+)<\/BaseURL>/gi)];
        for (const item of repUrlMatches) {
          const candidate = resolveUrl(dashUrl, String(item[1] || "").trim());
          if (candidate) {
            allAudioUrls.push(candidate);
          }
        }
      }
    }

    // Final fallback for uncommon manifests where audio URLs are obvious in the file path.
    if (!allAudioUrls.length) {
      const globalUrlMatches = [...xml.matchAll(/<BaseURL>([^<]+)<\/BaseURL>/gi)];
      for (const item of globalUrlMatches) {
        const raw = String(item[1] || "").trim();
        if (!/(audio|AUDIO_|\.m4a|\.mp4)/i.test(raw)) {
          continue;
        }

        if (/(video|CMAF_|DASH_\d+\.mp4)/i.test(raw)) {
          continue;
        }

        const candidate = resolveUrl(dashUrl, raw);
        if (candidate) {
          allAudioUrls.push(candidate);
        }
      }
    }

    if (!allAudioUrls.length) {
      return "";
    }

    const deduped = [...new Set(allAudioUrls)];
    const sorted = deduped.sort((a, b) => {
      const aScore = Number((a.match(/AUDIO_(\d+)/i) || [0, 0])[1]);
      const bScore = Number((b.match(/AUDIO_(\d+)/i) || [0, 0])[1]);
      return bScore - aScore;
    });

    return sorted[0];
  } catch {
    return "";
  }
}

async function muxVideoWithAudio(videoPath, audioPath, outputPath) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary not available");
  }

  await new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
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
      "-t",
      String(AUTO_REEL_MAX_SECONDS),
      "-shortest",
      outputPath
    ]);

    let stderr = "";
    ff.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg failed with code ${code}`));
    });
  });
}

async function prepareReelWithAudio(candidate) {
  if (candidate.postType !== "reel") {
    return candidate.mediaUrl;
  }

  // For reliable audio reels, we prefer muxed video+audio, but fall back to direct reel URL
  // so reel-only automation doesn't fail when Reddit DASH audio is unavailable.
  if (!hasUsablePublicBaseUrl()) {
    return candidate.mediaUrl;
  }

  const dashUrl = candidate.dashUrl || deriveDashUrlFromReelUrl(candidate.mediaUrl);
  const audioUrl = await pickDashAudioUrl(dashUrl);
  if (!audioUrl) {
    return candidate.mediaUrl;
  }

  const safeId = String(candidate.sourceId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
  const ts = Date.now();
  const tempVideo = path.resolve(uploadsDir, `tmp-video-${ts}-${safeId}.mp4`);
  const tempAudio = path.resolve(uploadsDir, `tmp-audio-${ts}-${safeId}.m4a`);
  const outputName = `auto-reel-${ts}-${safeId}.mp4`;
  const outputPath = path.resolve(uploadsDir, outputName);

  try {
    await downloadToFile(candidate.mediaUrl, tempVideo);
    await downloadToFile(audioUrl, tempAudio);
    await muxVideoWithAudio(tempVideo, tempAudio, outputPath);
    
    // Verify file was actually created and has content
    const stats = await fs.promises.stat(outputPath).catch(() => null);
    if (!stats || stats.size === 0) {
      throw new Error(`Reel muxing produced empty file (0 bytes)`);
    }

    const mediaUrl = `${getPublicBaseUrl()}/media/${outputName}`;
    
    // Accept locally-verified files. Instagram Graph API will validate URL reachability at upload time.
    // (Remote reachability checks can fail through tunnels/proxies even if Instagram can reach it)
    return mediaUrl;
  } catch (error) {
    console.error("Failed to prepare reel with audio", error?.message || error);
    return candidate.mediaUrl;
  } finally {
    await fs.promises.unlink(tempVideo).catch(() => {});
    await fs.promises.unlink(tempAudio).catch(() => {});
  }
}

async function cacheAutoImageCandidate(candidate) {
  if (candidate.postType !== "post") {
    return candidate.mediaUrl;
  }

  try {
    const response = await axios.get(candidate.mediaUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 20 * 1024 * 1024,
      headers: {
        "User-Agent": "InstaFlowScheduler/1.0",
        Accept: "image/*"
      }
    });

    const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error(`Unsupported image content-type: ${contentType || "unknown"}`);
    }

    // If no usable public base URL is configured, keep source URL only after successful validation.
    if (!hasUsablePublicBaseUrl()) {
      return candidate.mediaUrl;
    }

    const safeId = String(candidate.sourceId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `auto-${Date.now()}-${safeId}.jpg`;
    const filePath = path.resolve(uploadsDir, filename);
    const sourceBuffer = Buffer.from(response.data);
    await sharp(sourceBuffer).jpeg({ quality: 90 }).toFile(filePath);
    
    // Verify file was created and has content
    const stats = await fs.promises.stat(filePath).catch(() => null);
    if (!stats || stats.size === 0) {
      throw new Error(`Image caching produced empty file (0 bytes)`);
    }
    
    const mediaUrl = `${getPublicBaseUrl()}/media/${filename}`;
    
    // Accept locally-verified files. Instagram Graph API will validate URL reachability at upload time.
    // (Remote reachability checks can fail through tunnels/proxies even if Instagram can reach it)
    return mediaUrl;
  } catch (error) {
    console.error("Failed to cache auto image candidate", error?.message || error);
    return "";
  }
}

function toPublicConfig(config) {
  return {
    enabled: config.enabled,
    sourcePlatform: config.sourcePlatform,
    contentType: config.contentType,
    randomMode: config.randomMode,
    subreddits: config.subreddits,
    keywords: config.keywords,
    minScore: config.minScore,
    minWidth: config.minWidth,
    maxAgeHours: config.maxAgeHours,
    captionTemplate: config.captionTemplate,
    hashtagSets: config.hashtagSets,
    keywordSets: config.keywordSets,
    timeSlots: config.timeSlots,
    timezone: config.timezone,
    continuousSearchEnabled: Boolean(config.continuousSearchEnabled),
    continuousSearchContentType: config.continuousSearchContentType || "reel",
    continuousSearchRequestedAt: config.continuousSearchRequestedAt || null,
    continuousSearchLastAttemptAt: config.continuousSearchLastAttemptAt || null,
    updatedAt: config.updatedAt
  };
}

async function ensureConfig() {
  const config = await AutoAnimeConfig.findOneAndUpdate(
    { singletonKey: "default" },
    { $setOnInsert: { singletonKey: "default" } },
    { upsert: true, new: true }
  );

  if (!config.timeSlots?.length) {
    config.timeSlots = DEFAULT_SLOTS;
    await config.save();
  }

  if (!config.hashtagSets?.length) {
    config.hashtagSets = DEFAULT_HASHTAG_SETS;
    config.hashtagSetCursor = 0;
    await config.save();
  }

  if (!config.keywordSets?.length) {
    config.keywordSets = DEFAULT_KEYWORD_SETS;
    config.keywordSetCursor = 0;
    await config.save();
  }

  const legacyDefaultSubs = ["AnimeEdit", "AnimeMV", "AMV"];
  const existingSubs = Array.isArray(config.subreddits) ? [...config.subreddits] : [];
  const isLegacySubs =
    existingSubs.length === legacyDefaultSubs.length &&
    existingSubs.every((sub, idx) => sub === legacyDefaultSubs[idx]);

  if (isLegacySubs) {
    config.subreddits = FALLBACK_SUBREDDITS;
    config.contentType = "both";
    config.keywords = [];
    await config.save();
  }

  return config;
}

async function findAvailableCandidate(config, excludeKeys = new Set()) {
  const candidates = await getRedditAnimeCandidates(config);
  const recentSourceIds = new Set(config.recentSourceIds || []);

  for (const candidate of candidates) {
    if (!candidate.mediaUrl) {
      continue;
    }

    const candidateKey = `${candidate.sourceId}:${candidate.postType || "reel"}`;
    if (excludeKeys.has(candidateKey)) {
      continue;
    }

    if (recentSourceIds.has(candidateKey)) {
      continue;
    }

    const exists = await Post.exists({
      sourceId: candidate.sourceId,
      postType: candidate.postType || "reel"
    });
    if (!exists) {
      return candidate;
    }
  }

  const fallbackCandidates = await getRedditAnimeCandidates({
    ...config,
    subreddits: FALLBACK_SUBREDDITS,
    contentType: config.contentType || "both",
    keywords: [],
    minScore: Math.max(0, Number(config.minScore || 0) - 15),
    minWidth: Math.max(480, Number(config.minWidth || 0) - 240),
    maxAgeHours: Math.min(168, Math.max(Number(config.maxAgeHours || 72), 96))
  });

  for (const candidate of fallbackCandidates) {
    if (!candidate.mediaUrl) {
      continue;
    }

    const candidateKey = `${candidate.sourceId}:${candidate.postType || "reel"}`;
    if (excludeKeys.has(candidateKey)) {
      continue;
    }

    if (recentSourceIds.has(candidateKey)) {
      continue;
    }

    const exists = await Post.exists({
      sourceId: candidate.sourceId,
      postType: candidate.postType || "reel"
    });
    if (!exists) {
      return candidate;
    }
  }

  return null;
}

async function findCandidateFromRecentHistory(config, excludeKeys = new Set()) {
  const preferredTypes =
    config.contentType === "both"
      ? ["reel", "post"]
      : [config.contentType || "reel"];

  const recentPosted = await Post.find({
    sourcePlatform: "reddit",
    status: "posted",
    postType: { $in: preferredTypes }
  })
    .sort({ updatedAt: -1 })
    .limit(40)
    .lean();

  if (!recentPosted.length) {
    return null;
  }

  for (const item of recentPosted) {
    const key = `${item.sourceId || item._id}:${item.postType || "reel"}`;
    if (excludeKeys.has(key)) {
      continue;
    }

    if (!item.mediaUrl) {
      continue;
    }

    return {
      sourceId: `${item.sourceId || item._id}-replay-${Date.now()}`,
      sourceUrl: item.sourceUrl || item.mediaUrl,
      sourcePlatform: "reddit",
      postType: item.postType || "reel",
      mediaUrl: item.mediaUrl,
      dashUrl: (item.postType || "reel") === "reel" ? deriveDashUrlFromReelUrl(item.mediaUrl) : "",
      title: "Replay anime drop",
      subreddit: "anime"
    };
  }

  return null;
}

async function appendRecentSourceId(config, sourceId) {
  const next = [sourceId, ...(config.recentSourceIds || [])].slice(0, MAX_RECENT_SOURCE_IDS);
  config.recentSourceIds = next;
}

export async function getAutoAnimeConfig() {
  const config = await ensureConfig();
  return toPublicConfig(config);
}

export async function updateAutoAnimeConfig(payload) {
  const config = await ensureConfig();

  if (payload.enabled !== undefined) {
    config.enabled = Boolean(payload.enabled);
  }

  if (payload.timezone !== undefined) {
    config.timezone = String(payload.timezone || "").trim() || "Asia/Kolkata";
  }

  if (payload.contentType !== undefined) {
    const next = String(payload.contentType || "").trim().toLowerCase();
    config.contentType = ["reel", "post", "both"].includes(next) ? next : "reel";
  }

  if (payload.randomMode !== undefined) {
    config.randomMode = Boolean(payload.randomMode);
  }

  if (payload.captionTemplate !== undefined) {
    config.captionTemplate = String(payload.captionTemplate || "").trim();
  }

  if (payload.subreddits !== undefined) {
    config.subreddits = normalizeList(payload.subreddits)
      .map((value) => value.replace(/^r\//i, "").trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  if (payload.keywords !== undefined) {
    config.keywords = normalizeList(payload.keywords)
      .map((value) => value.toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  if (payload.timeSlots !== undefined) {
    const normalizedSlots = uniqueSortedSlots(normalizeList(payload.timeSlots).map((slot) => slot.trim()));
    config.timeSlots = normalizedSlots.length ? normalizedSlots : DEFAULT_SLOTS;
  }

  if (payload.minScore !== undefined) {
    config.minScore = Math.max(0, Number(payload.minScore) || 0);
  }

  if (payload.minWidth !== undefined) {
    config.minWidth = Math.max(240, Number(payload.minWidth) || 240);
  }

  if (payload.maxAgeHours !== undefined) {
    const value = Number(payload.maxAgeHours) || 72;
    config.maxAgeHours = Math.min(720, Math.max(1, value));
  }

  if (payload.hashtagSets !== undefined) {
    config.hashtagSets = sanitizeHashtagSets(payload.hashtagSets);
    config.hashtagSetCursor = 0;
  }

  if (payload.keywordSets !== undefined) {
    config.keywordSets = sanitizeKeywordSets(payload.keywordSets);
    config.keywordSetCursor = 0;
  }

  await config.save();
  return toPublicConfig(config);
}

export async function runAutoAnimeNow(options = {}) {
  const config = await ensureConfig();
  const trigger = options?.trigger === "scheduler" ? "scheduler" : "manual";
  const queueDelaySeconds =
    trigger === "manual"
      ? Math.max(0, Number(options?.queueDelaySeconds) || 45)
      : 0;
  const detectedUrl = getPublicBaseUrl();
  const noUsablePublicBaseUrl = !hasUsablePublicBaseUrl();
  const requestedContentType = String(config.contentType || "reel").toLowerCase();

  console.log(`[AUTO ANIME] Detected URL: ${detectedUrl}, Usable: ${!noUsablePublicBaseUrl}, Mode: ${requestedContentType}`);

  // Keep reel-only mode strict (no image fallback), but still try queueing direct public reel URLs.
  // PUBLIC_BASE_URL is only mandatory when we need to serve locally generated media files.

  const forcePostModeForLocal =
    noUsablePublicBaseUrl && requestedContentType === "both";
  const candidateConfig = forcePostModeForLocal
    ? { ...config.toObject(), contentType: "post" }
    : config;
  const attemptedCandidates = new Set();
  let candidate = null;
  let preparedMediaUrl = "";

  for (let i = 0; i < 8; i += 1) {
    candidate = await findAvailableCandidate(candidateConfig, attemptedCandidates);
    if (!candidate) {
      break;
    }

    if (candidate.postType === "post") {
      preparedMediaUrl = await cacheAutoImageCandidate(candidate);

      // For image posts, audio is not required. If caching fails, use direct image URL when reachable.
      if (!preparedMediaUrl && (await isMediaUrlReachable(candidate.mediaUrl))) {
        preparedMediaUrl = candidate.mediaUrl;
      }
    } else {
      preparedMediaUrl = await prepareReelWithAudio(candidate);
    }

    if (preparedMediaUrl) {
      break;
    }

    attemptedCandidates.add(`${candidate.sourceId}:${candidate.postType || "reel"}`);
    candidate = null;
  }

  if (!candidate) {
    candidate = await findCandidateFromRecentHistory(candidateConfig, attemptedCandidates);
    if (candidate) {
      if (candidate.postType === "post") {
        preparedMediaUrl = await cacheAutoImageCandidate(candidate);

        if (!preparedMediaUrl && (await isMediaUrlReachable(candidate.mediaUrl))) {
          preparedMediaUrl = candidate.mediaUrl;
        }
      } else {
        preparedMediaUrl = await prepareReelWithAudio(candidate);
      }
    }

    if (!candidate || !preparedMediaUrl) {
      if (forcePostModeForLocal) {
        return {
          queued: false,
          message:
            "Local mode detected: reels need a public PUBLIC_BASE_URL. For now, auto mode is trying posts only. Set a public HTTPS URL (ngrok/cloudflared) to enable reels."
        };
      }

      if (requestedContentType === "reel") {
        if (!config.continuousSearchEnabled) {
          config.continuousSearchEnabled = true;
          config.continuousSearchContentType = "reel";
          config.continuousSearchRequestedAt = new Date();
        }

        config.continuousSearchLastAttemptAt = new Date();
        await config.save();

        if (trigger === "manual") {
          return {
            queued: false,
            message:
              "Abhi reel nahi mili. Continuous search ON ho gaya hai, system har minute reel dhoondhega aur milte hi queue karega."
          };
        }

        return {
          queued: false,
          message: "Continuous reel search active: still looking for a publishable reel."
        };
      }

      return {
        queued: false,
        message: "No publishable anime media found now (Reddit may be rate-limited). Try again in a few minutes."
      };
    }
  }

  const rotating = pickRotatingHashtagSet(config);
  const rotatingKeywords = pickRotatingKeywordSet(config);
  if (!preparedMediaUrl) {
    return {
      queued: false,
      message: "Could not prepare media for upload. Try again in a minute."
    };
  }

  const post = await Post.create({
    mediaUrl: preparedMediaUrl,
    caption: renderCaption(config.captionTemplate, candidate, rotating.text, rotatingKeywords.text),
    postType: candidate.postType || "reel",
    scheduledTime: new Date(Date.now() + queueDelaySeconds * 1000),
    status: "pending",
    sourcePlatform: candidate.sourcePlatform,
    sourceId: candidate.sourceId,
    sourceUrl: candidate.sourceUrl
  });

  await appendRecentSourceId(config, `${candidate.sourceId}:${candidate.postType || "reel"}`);
  config.hashtagSets = rotating.sets;
  config.hashtagSetCursor = rotating.nextCursor;
  config.keywordSets = rotatingKeywords.sets;
  config.keywordSetCursor = rotatingKeywords.nextCursor;
  if (config.continuousSearchEnabled && (candidate.postType || "reel") === "reel") {
    config.continuousSearchEnabled = false;
    config.continuousSearchRequestedAt = null;
  }
  config.continuousSearchLastAttemptAt = new Date();
  await config.save();

  return {
    queued: true,
    postId: post._id,
    postType: candidate.postType || "reel",
    sourceUrl: candidate.sourceUrl,
    subreddit: candidate.subreddit,
    title: candidate.title
  };
}

export async function processAutoAnimeSchedule(now = new Date()) {
  const config = await ensureConfig();

  if (
    config.continuousSearchEnabled &&
    String(config.continuousSearchContentType || "reel").toLowerCase() === "reel"
  ) {
    const result = await runAutoAnimeNow({ trigger: "scheduler" });
    return {
      triggered: true,
      slot: null,
      queued: result.queued,
      message: result.message || "Continuous reel search attempt completed"
    };
  }

  if (!config.enabled) {
    return { triggered: false, reason: "disabled" };
  }

  const slots = uniqueSortedSlots(config.timeSlots);
  if (!slots.length) {
    return { triggered: false, reason: "no-slots" };
  }

  const { dateKey, timeKey } = formatDateParts(now, config.timezone || "Asia/Kolkata");

  if (!slots.includes(timeKey)) {
    return { triggered: false, reason: "not-slot-time" };
  }

  const alreadyRanOnDate = config.lastRunBySlot?.get(timeKey) === dateKey;
  if (alreadyRanOnDate) {
    return { triggered: false, reason: "already-ran" };
  }

  const result = await runAutoAnimeNow();

  config.lastRunBySlot.set(timeKey, dateKey);
  await config.save();

  return {
    triggered: true,
    slot: timeKey,
    queued: result.queued,
    message: result.message || "Auto anime run completed"
  };
}
