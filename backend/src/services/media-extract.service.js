import axios from "axios";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Resolve INSTAGRAM_COOKIES_FILE relative to project root
function getCookiesFilePath() {
  const envVal = process.env.INSTAGRAM_COOKIES_FILE;
  if (!envVal) return null;
  // Location is src/services/, so ../../../ takes us to project root
  const resolved = path.isAbsolute(envVal)
    ? envVal
    : path.resolve(__dirname, "../../../", envVal);
  return existsSync(resolved) ? resolved : null;
}

function isInstagramUrl(url) {
  return /instagram\.com\/(p|reel|tv)\//.test(url);
}

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractShortcode(url) {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * Strategy 0 – yt-dlp (most reliable).
 */
async function extractWithYtDlp(sourceUrl) {
  const cookieFile = getCookiesFilePath();
  const BASE_ARGS = ["-m", "yt_dlp", "-j", "--no-playlist"];
  
  const ATTEMPTS = [
    // 1. No cookies
    BASE_ARGS.concat(sourceUrl),
  ];

  // 2. Custom cookie file if provided in .env
  if (cookieFile) {
    ATTEMPTS.push(BASE_ARGS.concat(["--cookies", cookieFile, sourceUrl]));
  }

  // 3. Browser sessions (Chrome/Edge/Firefox)
  ATTEMPTS.push(BASE_ARGS.concat(["--cookies-from-browser", "chrome", sourceUrl]));
  ATTEMPTS.push(BASE_ARGS.concat(["--cookies-from-browser", "edge", sourceUrl]));
  ATTEMPTS.push(BASE_ARGS.concat(["--cookies-from-browser", "firefox", sourceUrl]));

  for (const args of ATTEMPTS) {
    try {
      let stdout;
      // Strategy: Try 'yt-dlp' binary directly, fallback to 'python -m yt_dlp'
      try {
        // Remove '-m' and 'yt_dlp' if calling binary directly
        const binArgs = args.filter(a => a !== "-m" && a !== "yt_dlp");
        const res = await execFileAsync("yt-dlp", binArgs, { timeout: 40000 });
        stdout = res.stdout;
      } catch (binErr) {
        if (binErr.code === "ENOENT") {
          // If yt-dlp binary not found, try python fallback
          const res = await execFileAsync("python", args, { timeout: 40000 });
          stdout = res.stdout;
        } else {
          throw binErr;
        }
      }

      const info = JSON.parse(stdout.trim());
      
      const mediaUrl = info.url || 
        (Array.isArray(info.requested_formats) ? info.requested_formats.find((f) => f.vcodec && f.vcodec !== "none")?.url : undefined) ||
        (Array.isArray(info.formats) ? [...info.formats].reverse().find((f) => f.url && f.vcodec && f.vcodec !== "none")?.url : undefined);
      
      if (mediaUrl) {
        return {
          mediaUrl,
          isVideo: info.vcodec ? info.vcodec !== "none" : (info.ext !== "jpg" && info.ext !== "png"),
          rawDesc: info.description || info.title || ""
        };
      }
    } catch (err) {
      // try next
    }
  }
  return null;
}

/**
 * Strategy 1 – parse og: meta tags.
 */
function extractFromOgTags(html) {
  const videoMatch = html.match(/<meta[^>]+property="og:video"[^>]+content="([^"]+)"/);
  const imageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  const descMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);
  const rawMediaUrl = videoMatch?.[1] ?? imageMatch?.[1];
  if (!rawMediaUrl) return null;
  return {
    mediaUrl: decodeHtmlEntities(rawMediaUrl),
    isVideo: Boolean(videoMatch),
    rawDesc: descMatch?.[1] ?? ""
  };
}

/**
 * Strategy 2 – parse JSON-LD data.
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
    } catch { /* skip */ }
  }
  return null;
}

/**
 * Strategy 3 – embed page.
 */
async function extractFromEmbedPage(shortcode) {
  const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/captioned/`;
  try {
    const res = await axios.get(embedUrl, { headers: BROWSER_HEADERS, timeout: 15000 });
    const html = res.data;

    const videoSrc = html.match(/<video[^>]+src="([^"]+)"/i)?.[1];
    if (videoSrc) return { mediaUrl: decodeHtmlEntities(videoSrc), isVideo: true, rawDesc: "" };

    const imgSrc = html.match(/<img[^>]+src="(https:\/\/scontent[^"]+)"/i)?.[1];
    if (imgSrc) return { mediaUrl: decodeHtmlEntities(imgSrc), isVideo: false, rawDesc: "" };

    return extractFromOgTags(html);
  } catch {
    return null;
  }
}

/**
 * Main Entry Point
 */
export async function extractMediaFromUrl(sourceUrl) {
  if (!isInstagramUrl(sourceUrl)) {
    throw new Error("URL is not a recognised Instagram post/reel link");
  }

  const shortcode = extractShortcode(sourceUrl);
  const isReelUrl = /instagram\.com\/reel\//.test(sourceUrl);

  // 1. yt-dlp (Most Reliable)
  let extracted = await extractWithYtDlp(sourceUrl);

  // 2. Embed strategy (Grateful fallback)
  if (!extracted && shortcode) {
    extracted = await extractFromEmbedPage(shortcode);
  }

  // 3. Main page scrape (Last resort)
  if (!extracted) {
    try {
      const response = await axios.get(sourceUrl, { headers: BROWSER_HEADERS, timeout: 15000 });
      const html = response.data;
      extracted = extractFromJsonLd(html) ?? extractFromOgTags(html);
    } catch { /* fail */ }
  }

  if (!extracted) {
    throw new Error("Could not extract media content. Post may be private or Instagram is blocking access.");
  }

  const { mediaUrl, isVideo, rawDesc } = extracted;
  return {
    mediaUrl,
    postType: (isReelUrl || isVideo) ? "reel" : "post",
    caption: buildCaption(rawDesc)
  };
}

function buildCaption(rawDesc) {
  if (!rawDesc) return "";
  const decoded = decodeHtmlEntities(rawDesc.trim());
  const colonIdx = decoded.indexOf(": ");
  return (colonIdx !== -1 ? decoded.slice(colonIdx + 2) : decoded).trim();
}
