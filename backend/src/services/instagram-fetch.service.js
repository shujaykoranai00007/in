import axios from "axios";

/**
 * Modern Browser Headers to avoid bot detection
 */
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  Referer: "https://www.google.com/"
};

/**
 * Discovery: Search an Instagram account's public page for recent reel shortcodes
 */
async function discoverAccountReels(username) {
  const url = `https://www.instagram.com/${username.replace("@", "")}/reels/`;
  console.log(`[IG FETCH] 🔎 Discovering reels from @${username}...`);

  try {
    const res = await axios.get(url, { headers: BROWSER_HEADERS, timeout: 15000 });
    const html = res.data;

    // Pattern for Instagram shortcodes in URLs like /reel/ABCDEFG123/
    const shortcodeMatches = [...html.matchAll(/\/reel\/([A-Za-z0-9_-]+)\//g)];
    const shortcodes = [...new Set(shortcodeMatches.map(m => m[1]))];

    console.log(`[IG FETCH] ✓ Found ${shortcodes.length} possible reels for @${username}`);
    return shortcodes.slice(0, 8); // Just the newest few
  } catch (err) {
    console.error(`[IG FETCH] ❌ Discovery failed for @${username}:`, err.message);
    return [];
  }
}

/**
 * Strategy: Extract from Embed Page (Provided by user)
 */
async function extractFromEmbedPage(shortcode) {
  const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/captioned/`;
  try {
    const res = await axios.get(embedUrl, { headers: BROWSER_HEADERS, timeout: 15000 });
    const html = res.data;

    // Video element: <video ... src="...">
    const videoSrc = html.match(/<video[^>]+src="([^"]+)"/i)?.[1];
    if (videoSrc) return { mediaUrl: decodeHtml(videoSrc), isVideo: true };

    // Image element: <img ... src="...">
    const imgSrc = html.match(/<img[^>]+src="(https:\/\/scontent[^"]+)"/i)?.[1];
    if (imgSrc) return { mediaUrl: decodeHtml(imgSrc), isVideo: false };

    return null;
  } catch {
    return null;
  }
}

/**
 * Strategy: Extract from Main Page Meta Tags (Provided by user)
 */
function extractFromMetaTags(html) {
  const videoMatch = html.match(/<meta[^>]+property="og:video"[^>]+content="([^"]+)"/);
  const imageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  const descMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);

  const rawUrl = videoMatch?.[1] || imageMatch?.[1];
  if (!rawUrl) return null;

  return {
    mediaUrl: decodeHtml(rawUrl),
    isVideo: Boolean(videoMatch),
    caption: descMatch?.[1] ? decodeHtml(descMatch[1]) : ""
  };
}

function decodeHtml(str) {
  return str
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');
}

/**
 * Main Fetcher for Automation
 */
export async function getInstagramReelCandidates(config) {
  const accounts = (config.instagramAccounts || []).length ? config.instagramAccounts : ["anime_edits", "amv_community", "anime_vibes"];
  const results = [];

  console.log(`[IG CANDIDATES] 📂 Sequential checking Instagram accounts...`);

  for (const account of accounts) {
    try {
      const shortcodes = await discoverAccountReels(account);

      for (const shortcode of shortcodes) {
        try {
          // Try embed page first (most open)
          let extracted = await extractFromEmbedPage(shortcode);

          // Fallback to direct page if embed fails (or for meta-data)
          if (!extracted) {
            const res = await axios.get(`https://www.instagram.com/reel/${shortcode}/`, { headers: BROWSER_HEADERS, timeout: 10000 });
            extracted = extractFromMetaTags(res.data);
          }

          if (extracted && extracted.mediaUrl) {
            results.push({
              sourceId: shortcode,
              sourceUrl: `https://www.instagram.com/reel/${shortcode}/`,
              sourcePlatform: "instagram",
              postType: extracted.isVideo ? "reel" : "post",
              mediaUrl: extracted.mediaUrl,
              title: extracted.caption || `Anime reel from @${account}`,
              subreddit: `@${account}`, // Use handle for reporting
              score: 100, // Instagram doesn't give us public score easily, so assume good
              width: 720 // Reels are standard 720+
            });
          }
        } catch (err) {
          // Skip individual failure
        }
      }
    } catch (err) {
      console.error(`[IG CANDIDATES] ❌ Failed for account @${account}:`, err.message);
    }
  }

  console.log(`[IG CANDIDATES] ✅ Final results: ${results.length} unique candidates extracted.`);
  return results;
}
