import axios from "axios";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Accept: "text/html"
};

function buildRequestHeaders(extra = {}) {
  const headers = {
    ...BROWSER_HEADERS,
    ...extra
  };

  const sessionId = String(process.env.INSTAGRAM_SESSIONID || "").trim();
  if (sessionId) {
    headers.Cookie = `sessionid=${sessionId}`;
    headers.Referer = "https://www.instagram.com/";
    headers["X-IG-App-ID"] = "936619743392459";
  }

  return headers;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isInstagramUrl(url) {
  return /instagram\.com\/(p|reel|tv)\//.test(url);
}

function normalizeInstagramUrl(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return sourceUrl;
  }
}

function extractShortcode(url) {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  return match?.[1] || null;
}

function extractMetaContentByProperty(html, propertyName) {
  const metaTags = html.match(/<meta[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const propertyMatch = tag.match(/\bproperty\s*=\s*(["'])(.*?)\1/i);
    if (!propertyMatch) {
      continue;
    }

    if (String(propertyMatch[2] || "").toLowerCase() !== propertyName.toLowerCase()) {
      continue;
    }

    const contentMatch = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
    if (contentMatch?.[2]) {
      return contentMatch[2];
    }
  }

  return "";
}

function extractFromOgTags(html) {
  const rawVideo = extractMetaContentByProperty(html, "og:video");
  const rawImage =
    extractMetaContentByProperty(html, "og:image") ||
    extractMetaContentByProperty(html, "twitter:image");
  const rawDesc = extractMetaContentByProperty(html, "og:description");

  const rawMediaUrl = rawVideo || rawImage;
  if (!rawMediaUrl) {
    return null;
  }

  return {
    mediaUrl: decodeHtmlEntities(rawMediaUrl),
    isVideo: Boolean(rawVideo),
    rawDesc: rawDesc || ""
  };
}

function extractFromJsonLd(html) {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (const [, raw] of blocks) {
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (item?.contentUrl) {
          return {
            mediaUrl: item.contentUrl,
            isVideo: item?.["@type"] === "VideoObject",
            rawDesc: item.caption || item.description || ""
          };
        }
        if (item?.video?.contentUrl) {
          return {
            mediaUrl: item.video.contentUrl,
            isVideo: true,
            rawDesc: item.caption || item.description || ""
          };
        }
        if (item?.image?.url) {
          return {
            mediaUrl: item.image.url,
            isVideo: false,
            rawDesc: item.caption || item.description || ""
          };
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return null;
}

function extractFromEmbedMarkup(html) {
  const videoSrc = html.match(/<video[^>]+src="([^"]+)"/i)?.[1];
  if (videoSrc) {
    return {
      mediaUrl: decodeHtmlEntities(videoSrc),
      isVideo: true,
      rawDesc: ""
    };
  }

  const imgSrc = html.match(/<img[^>]+src="(https:\/\/scontent[^"]+)"/i)?.[1];
  if (imgSrc) {
    return {
      mediaUrl: decodeHtmlEntities(imgSrc),
      isVideo: false,
      rawDesc: ""
    };
  }

  return null;
}

function extractFromSimpleOgRegex(html) {
  const patterns = [
    /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
  ];

  let mediaUrl = "";
  let isVideo = false;

  for (const [index, pattern] of patterns.entries()) {
    const match = html.match(pattern);
    if (match?.[1]) {
      mediaUrl = decodeHtmlEntities(match[1]);
      isVideo = index <= 1;
      break;
    }
  }

  if (!mediaUrl) {
    return null;
  }

  return {
    mediaUrl,
    isVideo,
    rawDesc: ""
  };
}

function extractFromInstagramApiPayload(payload) {
  const media =
    payload?.items?.[0] ||
    payload?.graphql?.shortcode_media ||
    payload?.data?.xdt_shortcode_media ||
    null;

  if (!media) {
    return null;
  }

  const isVideo = Boolean(media?.is_video || media?.video_url || media?.media_type === 2);
  const mediaUrl =
    media?.video_url ||
    media?.display_url ||
    media?.image_versions2?.candidates?.[0]?.url ||
    media?.thumbnail_src ||
    "";

  if (!mediaUrl) {
    return null;
  }

  const rawDesc =
    media?.caption?.text ||
    media?.edge_media_to_caption?.edges?.[0]?.node?.text ||
    "";

  return {
    mediaUrl,
    isVideo,
    rawDesc
  };
}

async function extractFromJsonEndpoint(normalizedUrl) {
  const jsonUrl = `${normalizedUrl}${normalizedUrl.endsWith("/") ? "" : "/"}?__a=1&__d=dis`;

  const { data } = await axios.get(jsonUrl, {
    headers: buildRequestHeaders({
      Accept: "application/json,text/plain,*/*",
      "X-Requested-With": "XMLHttpRequest"
    }),
    timeout: 15000,
    maxRedirects: 5
  });

  return extractFromInstagramApiPayload(data);
}

function buildCaption(rawDesc) {
  if (!rawDesc) {
    return "";
  }

  const decoded = decodeHtmlEntities(rawDesc.trim());
  const colonIdx = decoded.indexOf(": ");
  const clean = colonIdx !== -1 ? decoded.slice(colonIdx + 2) : decoded;
  return clean.trim();
}

function looksLikeVideoUrl(url = "") {
  const text = String(url || "").toLowerCase();
  return text.includes(".mp4") || text.includes("video") || text.includes("/reel/");
}

function tryDecodeEscapedUrl(raw = "") {
  if (!raw) {
    return "";
  }

  return raw
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\u002F/g, "/")
    .replace(/\\u003D/g, "=")
    .replace(/\\u003F/g, "?")
    .replace(/\\u0025/g, "%");
}

function extractVideoFromRawMarkup(html) {
  const escapedMp4UrlPattern = new RegExp("(https?:\\\\/\\\\/[^\\\"'\\s]+\\.mp4[^\\\"'\\s]*)", "i");
  const patterns = [
    /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<video[^>]+src=["']([^"']+)["']/i,
    /"video_url"\s*:\s*"([^\"]+\.mp4[^\"]*)"/i,
    /"contentUrl"\s*:\s*"([^\"]+\.mp4[^\"]*)"/i,
    escapedMp4UrlPattern,
    /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const decoded = decodeHtmlEntities(tryDecodeEscapedUrl(match[1]));
      if (looksLikeVideoUrl(decoded)) {
        return decoded;
      }
    }
  }

  return "";
}

function detectInstagramAccessIssue(html = "") {
  const text = String(html || "").toLowerCase();

  if (
    text.includes("post isn't available") ||
    text.includes("post isn\u2019t available") ||
    text.includes("the link may be broken") ||
    text.includes("page isn't available")
  ) {
    return "This Instagram post is unavailable (deleted, private, or invalid URL). Open the link in browser and make sure it is public.";
  }

  if (text.includes("this account is private") || text.includes("private account")) {
    return "This Instagram account/post is private. Use a public post URL or upload file directly.";
  }

  if (text.includes("login") && text.includes("instagram")) {
    return "Instagram requires login/session for this link. Add INSTAGRAM_SESSIONID on backend or use Upload File.";
  }

  return "";
}

async function fetchHtml(url, headers = {}) {
  const response = await axios.get(url, {
    headers: buildRequestHeaders(headers),
    timeout: 15000,
    maxRedirects: 5
  });

  return String(response.data || "");
}

async function fetchAndExtract(url, headers) {
  const response = await axios.get(url, {
    headers: buildRequestHeaders(headers),
    timeout: 15000,
    maxRedirects: 5
  });

  const html = response.data;
  return extractFromJsonLd(html) ?? extractFromOgTags(html);
}

export async function extractMediaFromUrl(sourceUrl, options = {}) {
  const { preferVideo = false } = options || {};
  const normalizedUrl = normalizeInstagramUrl(sourceUrl);

  if (!isInstagramUrl(normalizedUrl)) {
    throw new Error("URL is not a recognised Instagram post/reel link");
  }

  const shortcode = extractShortcode(normalizedUrl);
  const isReelUrl = /instagram\.com\/reel\//.test(normalizedUrl);

  let extracted = null;

  try {
    extracted = await fetchAndExtract(normalizedUrl, BROWSER_HEADERS);
  } catch {
    // Continue to embed-page fallback.
  }

  if (!extracted) {
    try {
      extracted = await fetchAndExtract(normalizedUrl, {
        "User-Agent": BROWSER_HEADERS["User-Agent"],
        Accept: "text/html"
      });
    } catch {
      // Continue to additional fallbacks.
    }
  }

  if (!extracted && shortcode) {
    const type = normalizedUrl.match(/instagram\.com\/(p|reel|tv)\//i)?.[1] || "p";
    const altUrl = `https://www.ddinstagram.com/${type}/${shortcode}/`;

    try {
      extracted = await fetchAndExtract(altUrl, {
        "User-Agent": BROWSER_HEADERS["User-Agent"],
        Accept: "text/html"
      });
    } catch {
      // Continue to embed-page fallback.
    }
  }

  if (!extracted && shortcode) {
    const embedCandidates = [
      `https://www.instagram.com/reel/${shortcode}/embed/captioned/`,
      `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
      `https://www.instagram.com/tv/${shortcode}/embed/captioned/`
    ];

    for (const embedUrl of embedCandidates) {
      try {
        const embedResponse = await axios.get(embedUrl, {
          headers: buildRequestHeaders(),
          timeout: 15000
        });
        const html = embedResponse.data;
        extracted =
          extractFromEmbedMarkup(html) ??
          extractFromJsonLd(html) ??
          extractFromOgTags(html);

        if (extracted) {
          break;
        }
      } catch {
        // Try next embed URL.
      }
    }
  }

  if (!extracted) {
    try {
      extracted = await extractFromJsonEndpoint(normalizedUrl);
    } catch {
      // Continue to final failure message.
    }
  }

  if (!extracted) {
    try {
      const response = await axios.get(normalizedUrl, {
        headers: buildRequestHeaders({
          "User-Agent": BROWSER_HEADERS["User-Agent"],
          Accept: "text/html"
        }),
        timeout: 15000,
        maxRedirects: 5
      });

      extracted = extractFromSimpleOgRegex(response.data);
    } catch {
      // Continue to final failure message.
    }
  }

  if (!extracted) {
    try {
      const sourceHtml = await fetchHtml(normalizedUrl, {
        "User-Agent": BROWSER_HEADERS["User-Agent"],
        Accept: "text/html"
      });

      const accessIssue = detectInstagramAccessIssue(sourceHtml);
      if (accessIssue) {
        throw new Error(accessIssue);
      }
    } catch (error) {
      if (error?.message && !String(error.message).toLowerCase().includes("timeout")) {
        throw error;
      }
    }

    throw new Error(
      "Could not extract media from this Instagram URL. Instagram may block this link. Use Upload File for guaranteed results."
    );
  }

  if (preferVideo && shortcode && extracted && !extracted.isVideo && !looksLikeVideoUrl(extracted.mediaUrl)) {
    const forceVideoCandidates = [
      `https://www.instagram.com/p/${shortcode}/`,
      `https://www.instagram.com/reel/${shortcode}/`,
      `https://www.ddinstagram.com/p/${shortcode}/`,
      `https://www.ddinstagram.com/reel/${shortcode}/`,
      `https://www.instagram.com/reel/${shortcode}/embed/captioned/`,
      `https://www.instagram.com/p/${shortcode}/embed/captioned/`
    ];

    for (const candidateUrl of forceVideoCandidates) {
      try {
        const candidateHtml = await fetchHtml(candidateUrl, {
          "User-Agent": BROWSER_HEADERS["User-Agent"],
          Accept: "text/html"
        });

        const rawVideo = extractVideoFromRawMarkup(candidateHtml);
        if (rawVideo) {
          extracted = {
            mediaUrl: rawVideo,
            isVideo: true,
            rawDesc: extracted?.rawDesc || ""
          };
          break;
        }

        const candidate =
          extractFromEmbedMarkup(candidateHtml) ??
          extractFromJsonLd(candidateHtml) ??
          extractFromOgTags(candidateHtml) ??
          extractFromSimpleOgRegex(candidateHtml);

        if (candidate && (candidate.isVideo || looksLikeVideoUrl(candidate.mediaUrl))) {
          extracted = {
            ...candidate,
            isVideo: true
          };
          break;
        }
      } catch {
        // Try next candidate URL.
      }
    }

    if (!extracted?.isVideo && !looksLikeVideoUrl(extracted?.mediaUrl || "")) {
      throw new Error(
        "This link resolved to an image post, not a reel video. Use a direct reel URL or Upload File for full reel posting."
      );
    }
  }

  return {
    mediaUrl: extracted.mediaUrl,
    postType: isReelUrl || extracted.isVideo ? "reel" : "post",
    caption: buildCaption(extracted.rawDesc)
  };
}
