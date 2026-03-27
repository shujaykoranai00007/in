import axios from "axios";

const REDDIT_TIMEOUT_MS = 15000;
const REDDIT_LIMIT = 60;
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
      "User-Agent": "InstaFlowScheduler/1.0 (+https://instaflow.app)",
      Accept: "application/json"
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

  if (!isRandomMode(config) && width < config.minWidth) {
    return null;
  }

  if (!isRandomMode(config) && score < config.minScore) {
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

  if (!isRandomMode(config) && width < config.minWidth) {
    return null;
  }

  if (!isRandomMode(config) && score < config.minScore) {
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
  let lastError = null;

  for (const baseURL of REDDIT_BASE_URLS) {
    const redditClient = createRedditClient(baseURL);

    for (let attempt = 1; attempt <= REDDIT_REQUEST_MAX_ATTEMPTS; attempt += 1) {
      try {
        const { data } = await redditClient.get(endpoint, {
          params: {
            limit: REDDIT_LIMIT,
            raw_json: 1,
            t: "day"
          }
        });

        const children = data?.data?.children || [];
        const posts = children.map((item) => item?.data).filter(Boolean);
        if (posts.length) {
          return posts;
        }

        break;
      } catch (error) {
        lastError = error;
        const status = Number(error?.response?.status || 0);

        // Retry once for transient issues; then move to next Reddit host.
        if (attempt < REDDIT_REQUEST_MAX_ATTEMPTS && (status === 429 || status >= 500 || status === 0)) {
          await delay(350 * attempt);
          continue;
        }

        break;
      }
    }
  }

  throw lastError || new Error("Unable to fetch subreddit feed from Reddit");
}

export async function getRedditAnimeCandidates(config) {
  const subreddits = config.subreddits.length ? config.subreddits : ["AnimeEdit"];
  const results = [];

  for (const subreddit of subreddits) {
    try {
      const [hotPosts, topPosts] = await Promise.all([
        fetchSubredditFeed(subreddit, "hot"),
        fetchSubredditFeed(subreddit, "top")
      ]);

      const merged = [...hotPosts, ...topPosts];
      for (const post of merged) {
        if (post.stickied || post.over_18 || post.is_gallery) {
          continue;
        }

        if (isAllowedType(config, "reel")) {
          const reelCandidate = extractReelCandidate(post, config);
          if (reelCandidate) {
            results.push(reelCandidate);
          }
        }

        if (isAllowedType(config, "post")) {
          const imageCandidate = extractImageCandidate(post, config);
          if (imageCandidate) {
            results.push(imageCandidate);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch subreddit ${subreddit}`, error?.message || error);
    }
  }

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

  if (!isRandomMode(config)) {
    return sorted;
  }

  // Shuffle in random mode so we don't always pick top-scored media.
  return sorted.sort(() => Math.random() - 0.5);
}
