import axios from "axios";

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Resolve INSTAGRAM_COOKIES_FILE relative to project root (three levels up from src/services/)
function getCookiesFilePath() {
  const envVal = process.env.INSTAGRAM_COOKIES_FILE;
  if (!envVal) return null;
  const resolved = path.isAbsolute(envVal)
    ? envVal
    : path.resolve(__dirname, "../../../", envVal);
  return existsSync(resolved) ? resolved : null;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none"
};

function isInstagramUrl(url) {
  return /instagram\.com\/(p|reel|tv)\//.test(url);
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Extract shortcode from an Instagram URL.
 * Handles /p/, /reel/, /tv/ paths.
 */
function extractShortcode(url) {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * Strategy 0 – yt-dlp (most reliable). Runs `python -m yt_dlp -j <url>`
 * which returns full JSON metadata including the direct CDN media URL
 * without downloading the file itself.
 */
async function extractWithYtDlp(sourceUrl) {
function parseYtDlpOutput(stdout) {
  const info = JSON.parse(stdout.trim());
  // Prefer top-level url, then a video format, then any format with a url
  const mediaUrl =
    info.url ||
    (Array.isArray(info.requested_formats)
      ? info.requested_formats.find((f) => f.vcodec && f.vcodec !== "none")?.url
      : undefined) ||
    (Array.isArray(info.formats)
      ? [...info.formats].reverse().find((f) => f.url && f.vcodec && f.vcodec !== "none")?.url ||
        [...info.formats].reverse().find((f) => f.url)?.url
      : undefined);
  if (!mediaUrl) return null;
  const isVideo = info.vcodec ? info.vcodec !== "none" : (info.ext !== "jpg" && info.ext !== "png");
  return { mediaUrl, isVideo, rawDesc: info.description || info.title || "" };
}

/**
 * Strategy 0 – yt-dlp (most reliable).
 * Attempts in order:
 *   1. No cookies (works for truly public posts)
 *   2. --cookies-from-browser chrome  (user's Chrome Instagram session)
 *   3. --cookies-from-browser edge    (user's Edge Instagram session)
 *   4. --cookies-from-browser firefox (user's Firefox Instagram session)
 */
async function extractWithYtDlp(sourceUrl) {
  const BASE_ARGS = ["-m", "yt_dlp", "-j", "--no-playlist"];
  const ATTEMPTS = [
    // no cookies — fastest, works for publicly accessible posts
    BASE_ARGS.concat(sourceUrl),
    // browser cookie extraction — works when the user is logged in to Instagram
    BASE_ARGS.concat(["--cookies-from-browser", "chrome", sourceUrl]),
    BASE_ARGS.concat(["--cookies-from-browser", "edge",   sourceUrl]),
    BASE_ARGS.concat(["--cookies-from-browser", "firefox", sourceUrl]),
  ];

  for (const args of ATTEMPTS) {
    try {
      const { stdout } = await execFileAsync("python", args, { timeout: 40000 });
      const result = parseYtDlpOutput(stdout);
      if (result) return result;
    } catch {
      // try next strategy
    }
  }
  return null;
}

/**
 * Strategy 1 – parse og: meta tags from a given HTML string.
 */
function extractFromOgTags(html) {
  const videoMatch = html.match(/<meta[^>]+property="og:video"[^>]+content="([^"]+)"/);
  const imageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  const descMatch  = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);
  const rawMediaUrl = videoMatch?.[1] ?? imageMatch?.[1];
  if (!rawMediaUrl) return null;
  return {
    mediaUrl: decodeHtmlEntities(rawMediaUrl),
    isVideo: Boolean(videoMatch),
    rawDesc: descMatch?.[1] ?? ""
  };
}

/**
 * Strategy 2 – parse JSON-LD structured data embedded in the page.
 * Instagram embeds VideoObject / ImageObject in <script type="application/ld+json">
 */
function extractFromJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of blocks) {
    try {
      const obj = JSON.parse(raw);
      const items = Array.isArray(obj) ? obj : [obj];
      for (const item of items) {
        if (item.contentUrl) return { mediaUrl: item.contentUrl, isVideo: item["@type"] === "VideoObject", rawDesc: item.caption || item.description || "" };
        if (item.video?.contentUrl) return { mediaUrl: item.video.contentUrl, isVideo: true, rawDesc: item.caption || "" };
      }
    } catch {
      // malformed JSON-LD, skip
    }
  }
  return null;
}

/**
 * Strategy 3 – fetch the embed/captioned page and pull out the actual media element.
 * Instagram's embed page is less aggressively gated and includes the media.
 */
async function extractFromEmbedPage(shortcode) {
  const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/captioned/`;
  let html;
  try {
    const res = await axios.get(embedUrl, { headers: BROWSER_HEADERS, timeout: 15000 });
    html = res.data;
  } catch {
    // try /p/ variant too
    try {
      const res2 = await axios.get(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, { headers: BROWSER_HEADERS, timeout: 15000 });
      html = res2.data;
    } catch {
      return null;
    }
  }

  // Embedded video element: <video ... src="...">
  const videoSrc = html.match(/<video[^>]+src="([^"]+)"/i)?.[1];
  if (videoSrc) return { mediaUrl: decodeHtmlEntities(videoSrc), isVideo: true, rawDesc: "" };

  // Embedded image element: <img ... src="https://scontent...">
  const imgSrc = html.match(/<img[^>]+src="(https:\/\/scontent[^"]+)"/i)?.[1];
  if (imgSrc) return { mediaUrl: decodeHtmlEntities(imgSrc), isVideo: false, rawDesc: "" };

  // Try og: tags in embed page as last resort
  return extractFromOgTags(html);
}

/**
 * Fetch Instagram page HTML and pull out:
 *  - direct CDN media URL (og:video for reels, og:image for photos)
 *  - detected postType ("reel" | "post")
 *  - caption from og:description
 *
 * The returned mediaUrl is a public scontent CDN URL that the
 * Instagram Graph API can reach when creating a media container.
 */
export async function extractMediaFromUrl(sourceUrl) {
  if (!isInstagramUrl(sourceUrl)) {
    throw new Error("URL is not a recognised Instagram post/reel link (must contain /p/, /reel/ or /tv/)");
  }

  const shortcode = extractShortcode(sourceUrl);
  const isReelUrl = /instagram\.com\/reel\//.test(sourceUrl);

  let extracted = null;

  // --- Strategy 0: yt-dlp (bypasses bot-detection, most reliable) ---
  extracted = await extractWithYtDlp(sourceUrl);

  // --- Strategy 1: fetch main page, try JSON-LD first then og: tags ---
  if (!extracted) {
    try {
      const response = await axios.get(sourceUrl, { headers: BROWSER_HEADERS, timeout: 15000 });
      const html = response.data;
      if (!html.includes("You must log in") && !html.includes("login_required")) {
        extracted = extractFromJsonLd(html) ?? extractFromOgTags(html);
      }
    } catch {
      // page fetch failed, move on to embed strategy
    }
  }

  // --- Strategy 2: embed/captioned page (less gated) ---
  if (!extracted && shortcode) {
    extracted = await extractFromEmbedPage(shortcode);
  }

  if (!extracted) {
    throw new Error(
      "Could not extract media from this Instagram URL. The post may be private or Instagram is blocking the request. Try copying a direct .mp4 / .jpg URL instead."
    );
  }

  const { mediaUrl, isVideo, rawDesc } = extracted;
  const isReel = isReelUrl || isVideo;

  return {
    mediaUrl,
    postType: isReel ? "reel" : "post",
    caption: buildCaption(rawDesc)
  };
}

function buildCaption(rawDesc) {
  if (!rawDesc) return "";
  const decoded = decodeHtmlEntities(rawDesc.trim());
  // og:description format: "N likes, N comments - Username: caption text"
  const colonIdx = decoded.indexOf(": ");
  const clean = colonIdx !== -1 ? decoded.slice(colonIdx + 2) : decoded;
  return clean.trim();
}
