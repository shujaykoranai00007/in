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
import { getInstagramReelCandidates } from "./instagram-fetch.service.js";
import { uploadToCatbox, uploadTo0x0St, mirrorMediaToPublicUrl } from "./instagram.service.js";

const SLOT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_SLOTS = ["09:00", "12:30", "18:00"];
const MAX_RECENT_SOURCE_IDS = 300;
const STOP_WORDS = new Set([
  "the", "and", "with", "edit", "anime", "amv", "mmv", "gmv", "reel", "video", "short", "shorts", "official", "best", "new", "hd", "4k", "1080p"
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

/** HELPER FUNCTIONS **/

function uniqueSortedSlots(slots = []) {
  return [...new Set(slots)].filter((slot) => SLOT_PATTERN.test(slot)).sort();
}

function normalizeList(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return raw.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function formatDateParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
  });
  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${byType.year}-${byType.month}-${byType.day}`,
    timeKey: `${byType.hour}:${byType.minute}`
  };
}

function cleanTitle(value) {
  return String(value || "").replace(/\[[^\]]*\]/g, " ").replace(/\([^\)]*\)/g, " ").replace(/[|_]/g, " ").replace(/\s+/g, " ").trim();
}

function toHashtagToken(value) {
  return String(value || "").replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map((piece) => piece[0].toUpperCase() + piece.slice(1).toLowerCase()).join("");
}

function extractTopicTokens(title) {
  const words = cleanTitle(title).toLowerCase().split(/\s+/).map((word) => word.replace(/[^a-z0-9]/g, "")).filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return [...new Set(words)].slice(0, 4);
}

function buildDynamicKeywordString(candidate) {
  const tokens = extractTopicTokens(candidate.title).map((token) => token.replace(/[^a-z0-9]/g, " ").trim()).filter(Boolean).slice(0, 5);
  if (!tokens.length) return "anime edit, anime reels, amv edit";
  return tokens.map((token) => (token.includes("anime") ? token : `anime ${token}`)).join(", ");
}

function inferAnimeLabel(title) {
  const cleaned = cleanTitle(title);
  if (!cleaned) return "This anime";
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
  const nicheTags = tokens.map((token) => `#${toHashtagToken(token)}`).filter((tag) => tag.length > 2).slice(0, 4);
  const coreTags = candidate.postType === "post" ? ["#AnimeEdit", "#AnimePost", "#AnimeLovers", "#OtakuCommunity", "#ExplorePage"] : ["#AnimeEdit", "#AnimeReels", "#AMV", "#EditCommunity", "#ExplorePage"];
  const uniqueTags = [...new Set([...nicheTags, ...coreTags])].slice(0, 10);
  const contentLabel = candidate.postType === "post" ? "post" : "reel";
  return [`${animeLabel} energy in one ${contentLabel}.`, `Rate this edit from 1-10 and comment your favorite scene.`, `Save and share with an anime friend for more daily drops.`, "", uniqueTags.join(" ")].join("\n").slice(0, MAX_CAPTION_LENGTH);
}

function sanitizeHashtagSets(rawSets = []) {
  const normalized = normalizeList(rawSets).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return normalized.length ? normalized : DEFAULT_HASHTAG_SETS;
}

function sanitizeKeywordSets(rawSets = []) {
  const normalized = normalizeList(rawSets).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return normalized.length ? normalized : DEFAULT_KEYWORD_SETS;
}

function pickRotatingHashtagSet(config) {
  const sets = sanitizeHashtagSets(config.hashtagSets);
  const index = Number(config.hashtagSetCursor || 0) % sets.length;
  return { text: sets[index], nextCursor: (index + 1) % sets.length, sets };
}

function pickRotatingKeywordSet(config) {
  const sets = sanitizeKeywordSets(config.keywordSets);
  const index = Number(config.keywordSetCursor || 0) % sets.length;
  return { text: sets[index], nextCursor: (index + 1) % sets.length, sets };
}

function renderCaption(template, candidate, rotatingHashtagText = "", rotatingKeywordText = "") {
  const safeTemplate = (template || "").trim();
  const smartCaption = buildSmartCaption(candidate);
  const dynamicKeywords = buildDynamicKeywordString(candidate);
  const mergedKeywords = [rotatingKeywordText, dynamicKeywords].filter(Boolean).join(", ");
  const keywordLine = mergedKeywords ? `Keywords: ${mergedKeywords}` : "";

  if (!safeTemplate) {
    if (!rotatingHashtagText) return keywordLine ? `${smartCaption}\n${keywordLine}` : smartCaption;
    const lines = smartCaption.split("\n");
    lines[lines.length - 1] = rotatingHashtagText;
    const withTags = lines.join("\n");
    return keywordLine ? `${withTags}\n${keywordLine}` : withTags;
  }

  const custom = safeTemplate.replaceAll("{{title}}", candidate.title).replaceAll("{{anime}}", inferAnimeLabel(candidate.title)).replaceAll("{{subreddit}}", candidate.subreddit).replaceAll("{{sourceUrl}}", candidate.sourceUrl);
  if (!/#\w+/.test(custom)) {
    const fallbackTags = rotatingHashtagText || smartCaption.split("\n").at(-1);
    const withTags = `${custom}\n\n${fallbackTags}`;
    return (keywordLine ? `${withTags}\n${keywordLine}` : withTags).slice(0, MAX_CAPTION_LENGTH);
  }
  return (keywordLine ? `${custom}\n${keywordLine}` : custom).slice(0, MAX_CAPTION_LENGTH);
}

/** MEDIA UTILS **/

function getPublicBaseUrl() {
  const candidates = [process.env.RENDER_EXTERNAL_URL, process.env.PUBLIC_BASE_URL];
  for (const c of candidates) {
    const value = String(c || "").trim();
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (["http:", "https:"].includes(parsed.protocol)) return parsed.origin;
    } catch {}
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

function hasUsablePublicBaseUrl() {
  const value = getPublicBaseUrl();
  if (!value || value.includes("localhost")) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return false;
    if (host.endsWith(".vercel.app") || host.endsWith(".netlify.app")) return false;
    return true;
  } catch { return false; }
}

async function isMediaUrlReachable(url) {
  try {
    const response = await axios.head(url, { timeout: 12000, maxRedirects: 5, headers: { "User-Agent": "InstaFlowScheduler/1.0" } });
    return response.status >= 200 && response.status < 400;
  } catch { return false; }
}

async function downloadToFile(url, outputPath) {
  const response = await axios.get(url, { responseType: "stream", timeout: 45000, maxContentLength: 250 * 1024 * 1024, headers: { "User-Agent": "InstaFlowScheduler/1.0" } });
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(outputPath);
    response.data.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
  });
}

async function muxVideoWithAudio(videoPath, audioPath, outputPath) {
  if (!ffmpegPath) throw new Error("ffmpeg binary not available");
  await new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      "-y", "-threads", "2", "-i", videoPath, "-i", audioPath,
      "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "ultrafast",
      "-crf", "32", "-maxrate", "1500k", "-bufsize", "2000k", "-tune", "fastdecode", "-max_muxing_queue_size", "128",
      "-profile:v", "main", "-level:v", "4.0", "-pix_fmt", "yuv420p",
      "-vf", "scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p",
      "-r", "30", "-g", "60", "-c:a", "aac", "-b:a", "64k", "-ar", "44100", "-ac", "2",
      "-movflags", "+faststart", "-t", String(AUTO_REEL_MAX_SECONDS), "-shortest", outputPath
    ]);
    let stderr = "";
    ff.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
    ff.on("error", reject);
    ff.on("close", (code) => { if (code === 0) resolve(); else reject(new Error(stderr || `ffmpeg failed with code ${code}`)); });
  });
}

function deriveDashUrlFromReelUrl(mediaUrl) {
  try {
    const parsed = new URL(mediaUrl);
    if (parsed.hostname.toLowerCase() !== "v.redd.it") return "";
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (!segments.length) return "";
    return `${parsed.protocol}//${parsed.host}/${segments[0]}/DASHPlaylist.mpd`;
  } catch { return ""; }
}

async function pickDashAudioUrl(dashUrl) {
  if (!dashUrl) return "";
  try {
    const { data } = await axios.get(dashUrl, { timeout: 15000, responseType: "text", headers: { "User-Agent": "InstaFlowScheduler/1.0" } });
    const xml = String(data || "");
    const audioMatches = [...xml.matchAll(/<BaseURL>([^<]+)<\/BaseURL>/gi)]
      .map(m => new URL(m[1].trim(), dashUrl).toString())
      .filter(url => /(audio|AUDIO_|\.m4a|\.mp4)/i.test(url) && !/(video|CMAF_|DASH_\d+\.mp4)/i.test(url));
    return audioMatches.sort((a,b) => b.length - a.length)[0] || "";
  } catch { return ""; }
}

/** COMPONENT PREPARATION **/

async function prepareReelWithAudio(candidate) {
  if (candidate.postType !== "reel") return candidate.mediaUrl;
  const dashUrl = candidate.dashUrl || deriveDashUrlFromReelUrl(candidate.mediaUrl);
  const audioUrl = await pickDashAudioUrl(dashUrl);
  if (!audioUrl) return candidate.mediaUrl;

  const safeId = String(candidate.sourceId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
  const ts = Date.now();
  const tempVideo = path.resolve(uploadsDir, `tmp-video-${ts}-${safeId}.mp4`);
  const tempAudio = path.resolve(uploadsDir, `tmp-audio-${ts}-${safeId}.m4a`);
  const outputName = `auto-reel-${ts}-${safeId}.mp4`;
  const outputPath = path.resolve(uploadsDir, outputName);

  try {
    console.log(`[AUTO ANIME] 📥 Starting parallel downloads for ${safeId}...`);
    await Promise.all([
      downloadToFile(candidate.mediaUrl, tempVideo),
      downloadToFile(audioUrl, tempAudio)
    ]);
    
    console.log(`[AUTO ANIME] 🎬 Muxing video and audio with 2 threads...`);
    await muxVideoWithAudio(tempVideo, tempAudio, outputPath);
    
    // Verify file exists
    const stats = await fs.promises.stat(outputPath).catch(() => null);
    if (!stats || stats.size === 0) throw new Error("Muxing produced empty file");

    const isPublic = hasUsablePublicBaseUrl();
    
    // If not public (localhost) OR explicitly on Render, we MUST mirror to a public host for Instagram to see it.
    if (!isPublic || !!process.env.RENDER_EXTERNAL_URL) {
      console.log(`[AUTO ANIME] ☁️ Media not public-ready. Mirroring to external host...`);
      
      // Public Mirrors (Primary Fallbacks)
      try {
        const mirroredUrl = await uploadToCatbox(outputPath);
        console.log(`[AUTO ANIME] ✅ Mirrored to Catbox: ${mirroredUrl}`);
        return mirroredUrl;
      } catch {
        try { 
          const mirroredUrl = await uploadTo0x0St(outputPath);
          console.log(`[AUTO ANIME] ✅ Mirrored to 0x0.st: ${mirroredUrl}`);
          return mirroredUrl; 
        }
        catch { 
          console.error(`[AUTO ANIME] ❌ All persistent mirrors FAILED.`);
          throw new Error("Could not mirror media to any public host.");
        }
      }
    }
    
    const localUrl = `${getPublicBaseUrl()}/media/${outputName}`;
    console.log(`[AUTO ANIME] ✅ Using local public URL: ${localUrl}`);
    return localUrl;
  } catch (error) {
    console.warn(`[AUTO ANIME] ⚠️ Reel preparation failed: ${error.message}. Falling back to source URL.`);
    return candidate.mediaUrl;
  } finally {
    [tempVideo, tempAudio].forEach(p => fs.promises.unlink(p).catch(() => {}));
  }
}

async function cacheAutoImageCandidate(candidate) {
  if (candidate.postType !== "post") return candidate.mediaUrl;
  try {
    const res = await axios.get(candidate.mediaUrl, { responseType: "arraybuffer", timeout: 30000, headers: { "User-Agent": "InstaFlowScheduler/1.0" } });
    const filename = `auto-${Date.now()}-${candidate.sourceId}.jpg`;
    const filePath = path.resolve(uploadsDir, filename);
    await sharp(Buffer.from(res.data)).jpeg({ quality: 90 }).toFile(filePath);
    return `${getPublicBaseUrl()}/media/${filename}`;
  } catch { return candidate.mediaUrl; }
}

/** CORE AUTOMATION **/

async function ensureConfig() {
  const config = await AutoAnimeConfig.findOneAndUpdate({ singletonKey: "default" }, { $setOnInsert: { singletonKey: "default" } }, { upsert: true, new: true });
  if (!config.timeSlots?.length) { config.timeSlots = DEFAULT_SLOTS; await config.save(); }
  if (!config.hashtagSets?.length) { config.hashtagSets = DEFAULT_HASHTAG_SETS; await config.save(); }
  if (!config.keywordSets?.length) { config.keywordSets = DEFAULT_KEYWORD_SETS; await config.save(); }
  return config;
}

export async function runAutoAnimeNow(options = {}) {
  try {
    const config = await ensureConfig();
    const trigger = options?.trigger === "scheduler" ? "scheduler" : "manual";
    
    // Update live status for dashboard
    config.lastRunStatus = "searching";
    config.lastRunAt = new Date();
    config.lastRunMessage = trigger === "manual" ? "Manual trigger started..." : "Scheduled run started...";
    await config.save();

    let candidates = [];
    if (config.sourcePlatform === "instagram") {
      config.lastRunMessage = "Searching Instagram accounts..."; await config.save();
      candidates = await getInstagramReelCandidates(config);
    } else {
      config.lastRunMessage = "Searching Reddit subreddits..."; await config.save();
      candidates = await getRedditAnimeCandidates(config);
    }

    if (!candidates.length) {
      config.lastRunStatus = "failed";
      config.lastRunMessage = "No candidates found on either platform.";
      if (trigger === "scheduler") config.continuousSearchEnabled = true;
      await config.save();
      return { queued: false, message: config.lastRunMessage };
    }

    config.lastRunStatus = "preparing";
    config.lastRunMessage = `Found ${candidates.length} candidates. Preparing best reel...`;
    await config.save();

    const recentSourceIds = new Set(config.recentSourceIds || []);
    let bestCandidate = null;
    let preparedMediaUrl = "";

    for (const candidate of candidates) {
      const key = `${candidate.sourceId}:${candidate.postType || "reel"}`;
      if (recentSourceIds.has(key)) continue;
      if (await Post.exists({ sourceId: candidate.sourceId })) continue;

      bestCandidate = candidate;
      const localMediaUrl = await (candidate.postType === "post" ? cacheAutoImageCandidate(candidate) : prepareReelWithAudio(candidate));
      
      if (localMediaUrl) {
        console.log(`[AUTO ANIME] 📤 Mirroring prepared ${candidate.postType} to public storage...`);
        const token = String(candidate.sourceId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
        preparedMediaUrl = await mirrorMediaToPublicUrl(localMediaUrl, token).catch((err) => {
          console.warn(`[AUTO ANIME] Mirror failed, using local URL: ${err.message}`);
          return localMediaUrl;
        });
        break;
      }
    }

    if (!preparedMediaUrl) {
      config.lastRunStatus = "failed";
      config.lastRunMessage = "Failed to prepare any found media.";
      await config.save();
      return { queued: false, message: config.lastRunMessage };
    }

    const rotatingHashtags = pickRotatingHashtagSet(config);
    const rotatingKeywords = pickRotatingKeywordSet(config);
    const post = await Post.create({
      mediaUrl: preparedMediaUrl,
      caption: renderCaption(config.captionTemplate, bestCandidate, rotatingHashtags.text, rotatingKeywords.text),
      postType: bestCandidate.postType || "reel",
      scheduledTime: new Date(Date.now() + (trigger === "manual" ? 60000 : 0)),
      status: "pending",
      sourcePlatform: bestCandidate.sourcePlatform,
      sourceId: bestCandidate.sourceId,
      sourceUrl: bestCandidate.sourceUrl
    });

    config.lastRunStatus = "success";
    config.lastRunMessage = `Successfully queued ${bestCandidate.postType}: ${bestCandidate.title.substring(0, 30)}...`;
    config.recentSourceIds = [ `${bestCandidate.sourceId}:${bestCandidate.postType || "reel"}`, ...(config.recentSourceIds || [])].slice(0, MAX_RECENT_SOURCE_IDS);
    config.hashtagSetCursor = rotatingHashtags.nextCursor;
    config.keywordSetCursor = rotatingKeywords.nextCursor;
    config.continuousSearchEnabled = false;
    await config.save();

    return { queued: true, postId: post._id, title: bestCandidate.title };
  } catch (error) {
    console.error(`[AUTO ANIME] ❌ CRITICAL ERROR:`, error.message);
    const config = await ensureConfig();
    config.lastRunStatus = "failed";
    config.lastRunMessage = `System Error: ${error.message}`;
    await config.save();
    return { queued: false, message: error.message };
  }
}

export async function processAutoAnimeSchedule(now = new Date()) {
  const config = await ensureConfig();
  const { dateKey, timeKey } = formatDateParts(now, config.timezone || "Asia/Kolkata");

  // Priority 1: Continuous Search (Catch up if dry spell occurred)
  if (config.continuousSearchEnabled) {
    console.log(`[AUTO ANIME] 🔄 Continuous search active... grabbing current candidate.`);
    return await runAutoAnimeNow({ trigger: "scheduler" });
  }

  // Priority 2: Standard Daily Slots
  if (!config.enabled) return { triggered: false, reason: "disabled" };
  const slots = uniqueSortedSlots(config.timeSlots);
  if (!slots.includes(timeKey)) return { triggered: false, reason: "not-slot-time" };

  if (config.lastRunBySlot?.get(timeKey) === dateKey) return { triggered: false, reason: "already-ran" };

  const result = await runAutoAnimeNow({ trigger: "scheduler" });
  if (result.queued) {
    config.lastRunBySlot.set(timeKey, dateKey);
    await config.save();
  }
  return result;
}

export async function getAutoAnimeConfig() {
  const config = await ensureConfig();
  return config.toObject();
}

export async function updateAutoAnimeConfig(payload) {
  const config = await ensureConfig();

  if (payload.enabled !== undefined) config.enabled = Boolean(payload.enabled);
  if (payload.timezone !== undefined) config.timezone = String(payload.timezone || "").trim() || "Asia/Kolkata";
  if (payload.sourcePlatform !== undefined) config.sourcePlatform = ["reddit", "instagram"].includes(payload.sourcePlatform) ? payload.sourcePlatform : "reddit";
  if (payload.contentType !== undefined) {
    const next = String(payload.contentType || "").trim().toLowerCase();
    config.contentType = ["reel", "post", "both"].includes(next) ? next : "reel";
  }
  if (payload.randomMode !== undefined) config.randomMode = Boolean(payload.randomMode);
  if (payload.captionTemplate !== undefined) config.captionTemplate = String(payload.captionTemplate || "").trim();

  if (payload.subreddits !== undefined) {
    config.subreddits = normalizeList(payload.subreddits).map(v => v.replace(/^r\//i, "").trim()).filter(Boolean).slice(0, 20);
  }
  if (payload.instagramAccounts !== undefined) {
    config.instagramAccounts = normalizeList(payload.instagramAccounts).map(v => v.replace(/^@/i, "").trim()).filter(Boolean).slice(0, 20);
  }
  if (payload.keywords !== undefined) {
    config.keywords = normalizeList(payload.keywords).map(v => v.toLowerCase().trim()).filter(Boolean).slice(0, 20);
  }
  if (payload.timeSlots !== undefined) {
    const slots = uniqueSortedSlots(normalizeList(payload.timeSlots).map(s => s.trim()));
    config.timeSlots = slots.length ? slots : DEFAULT_SLOTS;
  }

  if (payload.minScore !== undefined) config.minScore = Math.max(0, Number(payload.minScore) || 0);
  if (payload.minWidth !== undefined) config.minWidth = Math.max(240, Number(payload.minWidth) || 240);
  if (payload.maxAgeHours !== undefined) config.maxAgeHours = Math.min(720, Math.max(1, Number(payload.maxAgeHours) || 72));

  if (payload.hashtagSets !== undefined) { config.hashtagSets = sanitizeHashtagSets(payload.hashtagSets); config.hashtagSetCursor = 0; }
  if (payload.keywordSets !== undefined) { config.keywordSets = sanitizeKeywordSets(payload.keywordSets); config.keywordSetCursor = 0; }

  if (payload.continuousSearchEnabled !== undefined) config.continuousSearchEnabled = Boolean(payload.continuousSearchEnabled);

  await config.save();
  return config.toObject();
}
