import axios from "axios";

const REDDIT_TIMEOUT_MS = 15000;
const REDDIT_LIMIT = 100;
const REDDIT_BASE_URLS = [
  "https://www.reddit.com",
  "https://api.reddit.com",
  "https://old.reddit.com"
];
const REDDIT_REQUEST_MAX_ATTEMPTS = 2;

function createRedditClient(baseURL) {
  return axios.create({
    baseURL,
    timeout: REDDIT_TIMEOUT_MS,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
      Referer: "https://www.reddit.com/"
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(mediaUrl, { stripQuery = false } = {}) {
  if (!mediaUrl) {
    return "";
  }

  const normalized = String(mediaUrl).replaceAll("&amp;", "&");

  if (!stripQuery) {
    return normalized;
  }

  // Reel source URLs with tracker/query params are commonly rejected by Instagram.
  return normalized.split("?")[0];
}

function normalizePreviewImageUrl(mediaUrl) {
  try {
    const parsed = new URL(mediaUrl);
    if (parsed.hostname.toLowerCase() !== "preview.redd.it") {
      return mediaUrl;
    }

    const path = parsed.pathname.toLowerCase();
    if (path.endsWith(".png")) {
      parsed.searchParams.set("format", "png");
    } else {
      parsed.searchParams.set("format", "jpg");
    }

    parsed.searchParams.delete("auto");
    return parsed.toString();
  } catch {
    return mediaUrl;
  }
}

function isInstagramCompatibleImageUrl(mediaUrl) {
  if (!mediaUrl) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isDirectImageHost = hostname === "i.redd.it" || hostname === "preview.redd.it";
  if (!isDirectImageHost) {
    return false;
  }

  // Prefer JPG/PNG direct assets; WEBP and preview wrappers are frequently rejected.
  return /\.(jpe?g|png)$/i.test(parsed.pathname);
}

function matchesKeywords(post, keywords) {
  if (!keywords.length) {
    return true;
  }

  const haystack = `${post.title || ""} ${post.link_flair_text || ""}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function isAllowedType(config, type) {
  return config.contentType === "both" || config.contentType === type;
}

function isRandomMode(config) {
  return config?.randomMode !== false;
}

function resolveRedditVideoPayload(post) {
  const sources = [post, ...(Array.isArray(post?.crosspost_parent_list) ? post.crosspost_parent_list : [])].filter(Boolean);

  for (const source of sources) {
    const redditVideo = source?.secure_media?.reddit_video || source?.media?.reddit_video;
    if (redditVideo?.fallback_url) {
      return { redditVideo, source };
    }
  }

  return null;
}

function extractReelCandidate(post, config) {
  const resolved = resolveRedditVideoPayload(post);
  if (!resolved) {
    return null;
  }

  const { redditVideo, source } = resolved;

  const width = Number(redditVideo.width || source?.preview?.images?.[0]?.source?.width || 0);
  const score = Number(post.score || 0);

  if (!isRandomMode(config) && width < Math.max(480, config.minWidth - 240)) {
    console.log(`[REDDIT REEL] ⏩ Skipping "${(post.title || "Untitled").substring(0, 30)}..." - Width ${width} < ${Math.max(480, config.minWidth - 240)}`);
    return null;
  }

  if (!isRandomMode(config) && score < Math.max(0, config.minScore - 15)) {
    console.log(`[REDDIT REEL] ⏩ Skipping "${(post.title || "Untitled").substring(0, 30)}..." - Score ${score} < ${Math.max(0, config.minScore - 15)}`);
    return null;
  }

  const createdUtcMs = Number(post.created_utc || 0) * 1000;
  const ageHours = (Date.now() - createdUtcMs) / (1000 * 60 * 60);

  if (!isRandomMode(config) && ageHours > config.maxAgeHours) {
    console.log(`[REDDIT REEL] ⏩ Skipping "${(post.title || "Untitled").substring(0, 30)}..." - Age ${ageHours.toFixed(1)}h > ${config.maxAgeHours}h`);
    return null;
  }

  if (!isRandomMode(config) && !matchesKeywords(post, config.keywords)) {
    console.log(`[REDDIT REEL] ⏩ Skipping "${(post.title || "Untitled").substring(0, 30)}..." - No keywords match`);
    return null;
  }

  return {
    sourceId: post.id || source?.id,
    sourceUrl: `https://www.reddit.com${post.permalink || source?.permalink || ""}`,
    sourcePlatform: "reddit",
    postType: "reel",
    mediaUrl: normalizeUrl(redditVideo.fallback_url),
    dashUrl: normalizeUrl(redditVideo.dash_url || ""),
    title: post.title || "Anime edit",
    subreddit: post.subreddit,
    score,
    width
  };
}

function pickBestImageUrl(post) {
  const candidates = [
    post?.url_overridden_by_dest,
    post?.url,
    post?.preview?.images?.[0]?.source?.url
  ].filter(Boolean);

  for (const candidateUrl of candidates) {
    const normalized = normalizePreviewImageUrl(normalizeUrl(candidateUrl));
    if (isInstagramCompatibleImageUrl(normalized)) {
      return normalized;
    }
  }

  return "";
}

function extractImageCandidate(post, config) {
  const mediaUrl = pickBestImageUrl(post);
  if (!mediaUrl) {
    return null;
  }

  const previewWidth = Number(post?.preview?.images?.[0]?.source?.width || 0);
  const width = previewWidth || 1080;
  const score = Number(post.score || 0);

  if (!isRandomMode(config) && width < Math.max(480, config.minWidth - 240)) {
    return null;
  }

  if (!isRandomMode(config) && score < Math.max(0, config.minScore - 15)) {
    return null;
  }

  const createdUtcMs = Number(post.created_utc || 0) * 1000;
  const ageHours = (Date.now() - createdUtcMs) / (1000 * 60 * 60);

  if (!isRandomMode(config) && ageHours > config.maxAgeHours) {
    return null;
  }

  if (!isRandomMode(config) && !matchesKeywords(post, config.keywords)) {
    return null;
  }

  return {
    sourceId: post.id,
    sourceUrl: `https://www.reddit.com${post.permalink}`,
    sourcePlatform: "reddit",
    postType: "post",
    mediaUrl,
    title: post.title || "Anime still",
    subreddit: post.subreddit,
    score,
    width
  };
}

async function fetchSubredditFeed(subreddit, sort = "hot") {
  const endpoint = `/r/${encodeURIComponent(subreddit)}/${sort}.json`;
  for (const baseURL of REDDIT_BASE_URLS) {
    const redditClient = createRedditClient(baseURL);
    try {
      const { data } = await redditClient.get(endpoint, {
        params: {
          limit: REDDIT_LIMIT,
          raw_json: 1,
          ...(sort === "top" ? { t: "day" } : {})
        }
      });
      const children = data?.data?.children || [];
      const posts = children.map((item) => item?.data).filter(Boolean);
      if (posts.length) return posts;
    } catch (err) { /* ignore and try next host */ }
  }
  return [];
}

async function fetchRedditSearch(query, sort = "hot") {
  const endpoint = `/search.json`;
  for (const baseURL of REDDIT_BASE_URLS) {
    const redditClient = createRedditClient(baseURL);
    try {
      const { data } = await redditClient.get(endpoint, {
        params: { q: query, sort, limit: REDDIT_LIMIT, raw_json: 1, t: "day" }
      });
      const children = data?.data?.children || [];
      const posts = children.map((item) => item?.data).filter(Boolean);
      if (posts.length) return posts;
    } catch (err) { /* try next host */ }
  }
  return [];
}



export async function getRedditAnimeCandidates(config) {
  const subreddits = config.subreddits.length ? config.subreddits : ["Animeedits", "AnimeMusicVideos", "anime_edits", "anime", "AnimeMeme", "animememes"];
  const results = [];

  console.log(`[REDDIT CANDIDATES] 📂 Parallel fetching across ${subreddits.length} subreddits...`);
  
  const subredditPromises = subreddits.map(async (subreddit) => {
    try {
      const [hotPosts, topPosts] = await Promise.all([
        fetchSubredditFeed(subreddit, "hot"),
        fetchSubredditFeed(subreddit, "top")
      ]);

      const merged = [...hotPosts, ...topPosts];
      const subredditResults = [];

      for (const post of merged) {
        if (post.stickied || post.over_18 || post.is_gallery) {
          continue;
        }

        if (isAllowedType(config, "reel")) {
          const reelCandidate = extractReelCandidate(post, config);
          if (reelCandidate) subredditResults.push(reelCandidate);
        }

        if (isAllowedType(config, "post")) {
          const imageCandidate = extractImageCandidate(post, config);
          if (imageCandidate) subredditResults.push(imageCandidate);
        }
      }

      console.log(`[REDDIT CANDIDATES] ✓ /r/${subreddit}: Extracted ${subredditResults.length} candidates`);
      return subredditResults;
    } catch (error) {
      const statusCode = error.response?.status || "UNK";
      console.error(`[REDDIT CANDIDATES] ❌ /r/${subreddit} [HTTP ${statusCode}]: ${error.message}`);
      return [];
    }
  });

  const allSubredditResults = await Promise.all(subredditPromises);
  results.push(...allSubredditResults.flat());

  if (results.length === 0) {
    console.log(`[REDDIT CANDIDATES] 🔦 No results from subreddits. Trying global search fallback...`);
    const searchPosts = await fetchRedditSearch("anime edit", "hot");
    for (const post of searchPosts) {
      if (post.stickied || post.over_18 || post.is_gallery) continue;
      const reelCandidate = extractReelCandidate(post, config);
      if (reelCandidate) results.push(reelCandidate);
      const imageCandidate = extractImageCandidate(post, config);
      if (imageCandidate) results.push(imageCandidate);
    }
  }

  console.log(`[REDDIT CANDIDATES] Deduplicating ${results.length} total results...`);

  const deduped = new Map();
  for (const item of results) {
    const dedupeKey = `${item.sourceId}:${item.postType}`;
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, item);
    }
  }

  const sorted = [...deduped.values()].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return b.width - a.width;
  });

  console.log(`[REDDIT CANDIDATES] ✅ Final result: ${sorted.length} unique candidates (deduped from ${results.length})`);
  if (sorted.length === 0 && !isRandomMode(config)) {
    console.warn(`[REDDIT CANDIDATES] 🔦 Initial search returned 0 results. Running EMERGENCY FALLBACK pass (ignoring all filters)...`);
    const fallbackResults = await getRedditAnimeCandidates({ ...config, randomMode: true });
    return fallbackResults;
  }

  if (sorted.length === 0) {
    console.warn(`[REDDIT CANDIDATES] ⚠️  WARNING: Even fallback found 0 candidates! Check Reddit connectivity.`);
  }

  if (!isRandomMode(config)) {
    return sorted;
  }

  // Shuffle in random mode so we don't always pick top-scored media.
  return sorted.sort(() => Math.random() - 0.5);
}
