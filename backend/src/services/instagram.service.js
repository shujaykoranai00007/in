import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import FormData from "form-data";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";

const graphApi = axios.create({
  baseURL: "https://graph.facebook.com/v19.0",
  timeout: 30000
});

const CONTAINER_READY_MAX_CHECKS = 20;
const CONTAINER_READY_DELAY_MS = 3000;
const MIRROR_MAX_BYTES = 400 * 1024 * 1024;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPrivateOrLocalHost(hostname) {
  if (!hostname) {
    return true;
  }

  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".local") || normalized === "127.0.0.1") {
    return true;
  }

  if (normalized.startsWith("10.")) {
    return true;
  }

  if (normalized.startsWith("192.168.")) {
    return true;
  }

  if (normalized.startsWith("172.")) {
    const secondOctet = Number(normalized.split(".")[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}

function validatePublicMediaUrl(mediaUrl) {
  let parsed;

  try {
    parsed = new URL(mediaUrl);
  } catch {
    throw new Error("mediaUrl is invalid. Provide a valid public URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("mediaUrl must use http or https.");
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error(
      "Media URL must be publicly reachable by Instagram (not localhost/private network). Use a public URL or tunnel."
    );
  }
}

function validateInstagramImageUrl(mediaUrl) {
  const path = new URL(mediaUrl).pathname.toLowerCase();
  if (!path.endsWith(".jpg") && !path.endsWith(".jpeg") && !path.endsWith(".png")) {
    throw new Error(
      "For image posts, media URL must point to a JPG/JPEG/PNG file. Upload via this app to auto-convert unsupported formats."
    );
  }
}

function getPublicBaseUrl() {
  const configured = String(process.env.PUBLIC_BASE_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return `http://localhost:${env.port || 5000}`;
}

function canHostPublicMedia() {
  const base = getPublicBaseUrl();
  try {
    const parsed = new URL(base);
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

    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isInstagramFetchError(error) {
  const msg = String(error?.response?.data?.error?.message || error?.message || "").toLowerCase();
  const code = Number(error?.response?.data?.error?.code || 0);

  return (
    code === 2207076 ||
    msg.includes("2207076") ||
    msg.includes("could not download media") ||
    msg.includes("media upload has failed")
  );
}

function isInstagramMediaTypeError(error) {
  const msg = String(error?.response?.data?.error?.message || error?.message || "").toLowerCase();
  return msg.includes("only photo or video can be accepted as media type");
}

function toPlainPost(post) {
  if (post && typeof post.toObject === "function") {
    return post.toObject();
  }

  return { ...post };
}

function isInstagramProcessingFetchError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("2207076") ||
    msg.includes("media upload has failed") ||
    msg.includes("could not download media")
  );
}

async function uploadTo0x0St(filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const response = await axios.post("https://0x0.st", form, {
    headers: form.getHeaders(),
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });

  const url = String(response?.data || "").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("0x0.st did not return a valid URL");
  }

  return url;
}

async function uploadToCatbox(filePath) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", fs.createReadStream(filePath));

  const response = await axios.post("https://catbox.moe/user/api.php", form, {
    headers: form.getHeaders(),
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });

  const url = String(response?.data || "").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("catbox.moe did not return a valid URL");
  }

  return url;
}

async function uploadToTmpfiles(filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const response = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
    headers: form.getHeaders(),
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });

  const pageUrl = String(response?.data?.data?.url || "").trim();
  if (!pageUrl.startsWith("http://") && !pageUrl.startsWith("https://")) {
    throw new Error("tmpfiles did not return a valid URL");
  }

  return pageUrl.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
}

function resolveLocalMediaPathFromUrl(mediaUrl) {
  try {
    const parsed = new URL(mediaUrl);
    if (!parsed.pathname.startsWith("/media/")) {
      return null;
    }

    const filename = path.basename(parsed.pathname);
    if (!filename) {
      return null;
    }

    const candidate = path.resolve(uploadsDir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    return null;
  } catch {
    return null;
  }
}

async function mirrorMediaToPublicUrl(mediaUrl, token) {
  const ts = Date.now();
  const sourcePathname = (() => {
    try {
      return new URL(mediaUrl).pathname;
    } catch {
      return ".mp4";
    }
  })();

  const ext = path.extname(sourcePathname) || ".mp4";
  const tempDownloadPath = path.resolve(uploadsDir, `tmp-mirror-${ts}-${token}${ext}`);
  const localExistingPath = resolveLocalMediaPathFromUrl(mediaUrl);
  const sourcePath = localExistingPath || tempDownloadPath;
  const shouldDeleteSource = !localExistingPath;

  try {
    if (!localExistingPath) {
      await downloadToFile(mediaUrl, tempDownloadPath);
    }

    const stats = await fs.promises.stat(sourcePath);
    if (stats.size <= 0 || stats.size > MIRROR_MAX_BYTES) {
      throw new Error("Media file size is invalid for mirror upload");
    }

    const uploaders = [uploadTo0x0St, uploadToCatbox, uploadToTmpfiles];
    let lastError = null;

    for (const uploader of uploaders) {
      try {
        const mirroredUrl = await uploader(sourcePath);
        validatePublicMediaUrl(mirroredUrl);
        return mirroredUrl;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("No mirror provider succeeded");
  } finally {
    if (shouldDeleteSource) {
      await fs.promises.unlink(tempDownloadPath).catch(() => {});
    }
  }
}

async function downloadToFile(url, outputPath) {
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 45000,
    maxContentLength: 400 * 1024 * 1024,
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

async function transcodeToInstagramReel(inputPath, outputPath) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available on server.");
  }

  const hasAudio = await new Promise((resolve, reject) => {
    const probe = spawn(ffmpegPath, [
      "-v",
      "error",
      "-i",
      inputPath,
      "-map",
      "0:a:0",
      "-f",
      "null",
      "-"
    ]);

    probe.on("error", reject);
    probe.on("close", (code) => {
      resolve(code === 0);
    });
  });

  const args = [
    "-y",
    "-i",
    inputPath
  ];

  if (!hasAudio) {
    args.push(
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=stereo"
    );
  }

  args.push(
    "-map",
    "0:v:0",
    "-map",
    hasAudio ? "0:a:0" : "1:a:0",
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
        return;
      }

      reject(new Error(stderr || `ffmpeg failed with code ${code}`));
    });
  });
}

async function normalizeReelMedia(post) {
  if (post.postType !== "reel") {
    return post;
  }

  try {
    const parsed = new URL(post.mediaUrl);
    const trustedMirrorHosts = new Set([
      "files.catbox.moe",
      "0x0.st",
      "tmpfiles.org"
    ]);

    if (trustedMirrorHosts.has(parsed.hostname.toLowerCase())) {
      console.log("[Reel] Skipping normalization - using trusted public mirror URL");
      return post;
    }
  } catch {
    // Keep existing flow for invalid URLs; validatePublicMediaUrl handles these later.
  }

  if (!canHostPublicMedia()) {
    console.log("[Reel] Skipping normalization - no public media hosting available");
    return post;
  }

  // If media URL already ends with /media/ (local generated reel), it's pre-formatted for Instagram
  // Skip extra transcoding to avoid double-processing
  const url = post.mediaUrl.toLowerCase();
  const isPreGeneratedReel = url.includes("/media/auto-reel-") || url.includes("/media/normalized-reel-");
  if (isPreGeneratedReel) {
    console.log("[Reel] Skipping normalization - already pre-generated with audio");
    return post;
  }

  const token = String(post._id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
  const ts = Date.now();
  const inputPath = path.resolve(uploadsDir, `tmp-source-${ts}-${token}.mp4`);
  const outputName = `normalized-reel-${ts}-${token}.mp4`;
  const outputPath = path.resolve(uploadsDir, outputName);

  try {
    console.log(`[Reel] Starting normalization for: ${post.mediaUrl.substring(0, 60)}`);
    await downloadToFile(post.mediaUrl, inputPath);
    
    const inputStats = await fs.promises.stat(inputPath);
    console.log(`[Reel] Downloaded source: ${(inputStats.size / 1024 / 1024).toFixed(2)}MB`);
    
    await transcodeToInstagramReel(inputPath, outputPath);
    
    const outputStats = await fs.promises.stat(outputPath);
    console.log(`[Reel] Transcoded output: ${(outputStats.size / 1024 / 1024).toFixed(2)}MB`);

    const normalizedUrl = `${getPublicBaseUrl()}/media/${outputName}`;
    console.log(`[Reel] Normalization complete: ${normalizedUrl.substring(0, 60)}`);
    
    return {
      ...post,
      mediaUrl: normalizedUrl
    };
  } catch (error) {
    console.error(`[Reel] Normalization failed, will try original URL: ${error?.message || error}`);
    // Return original post - Instagram will handle validation or reject at upload time with clear error
    return post;
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
  }
}

function buildContainerPayload(post) {
  if (post.postType === "reel") {
    return {
      media_type: "REELS",
      video_url: post.mediaUrl,
      caption: post.caption,
      access_token: env.instagramAccessToken
    };
  }

  return {
    image_url: post.mediaUrl,
    caption: post.caption,
    access_token: env.instagramAccessToken
  };
}

async function getContainerStatus(creationId) {
  const { data } = await graphApi.get(`/${creationId}`, {
    params: {
      fields: "id,status_code,status",
      access_token: env.instagramAccessToken
    }
  });

  return data;
}

async function waitForContainerReady(creationId, postType) {
  if (postType !== "reel") {
    return;
  }

  for (let i = 0; i < CONTAINER_READY_MAX_CHECKS; i += 1) {
    const status = await getContainerStatus(creationId);
    const statusCode = status?.status_code;

    if (statusCode === "FINISHED") {
      return;
    }

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      const reason = status?.status || "Container processing failed";
      throw new Error(`Instagram reel processing failed: ${reason}`);
    }

    await sleep(CONTAINER_READY_DELAY_MS);
  }

  const pendingError = new Error("Instagram reel is still processing");
  pendingError.code = "REEL_STILL_PROCESSING";
  throw pendingError;
}

export async function createMediaContainer(post) {
  const createWithPost = async (postToCreate) => {
    validatePublicMediaUrl(postToCreate.mediaUrl);
    if (postToCreate.postType === "post") {
      validateInstagramImageUrl(postToCreate.mediaUrl);
    }

    if (postToCreate.postType === "reel") {
      console.log(`[Instagram] Pre-flight: Testing URL reachability for ${postToCreate.mediaUrl.substring(0, 60)}`);
      try {
        const headCheck = await axios.head(postToCreate.mediaUrl, {
          timeout: 10000,
          maxRedirects: 5,
          headers: {
            "User-Agent": "InstaFlowScheduler/1.0"
          }
        });
        if (headCheck.status < 200 || headCheck.status >= 400) {
          throw new Error(`URL returned HTTP ${headCheck.status}`);
        }
        console.log(`[Instagram] Pre-flight OK: URL is reachable (HTTP ${headCheck.status})`);
      } catch (headErr) {
        console.warn(
          `[Instagram] Pre-flight WARN: Could not verify URL reachability - ${headErr.message}. Instagram will validate at upload time.`
        );
      }
    }

    const payload = buildContainerPayload(postToCreate);
    console.log(`[Instagram] Creating container - Type: ${postToCreate.postType}, URL: ${postToCreate.mediaUrl.substring(0, 80)}`);
    const { data } = await graphApi.post(`/${env.instagramUserId}/media`, null, {
      params: payload
    });

    if (!data?.id) {
      throw new Error("Instagram container creation failed - no creation ID returned");
    }

    console.log(`[Instagram] Container created successfully: ${data.id} (${postToCreate.postType})`);
    return { creationId: data.id, mediaUrl: postToCreate.mediaUrl };
  };

  try {
    return await createWithPost(post);
  } catch (error) {
    if ((post.postType === "reel" || post.postType === "post") && (isInstagramFetchError(error) || isInstagramMediaTypeError(error))) {
      try {
        const token = String(post._id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
        console.warn(`[Instagram] Trying mirror fallback for ${post.postType} URL: ${post.mediaUrl.substring(0, 80)}`);
        const mirroredUrl = await mirrorMediaToPublicUrl(post.mediaUrl, token);
        console.warn(`[Instagram] Mirror fallback URL ready: ${mirroredUrl.substring(0, 80)}`);

        const retryPost = {
          ...toPlainPost(post),
          mediaUrl: mirroredUrl
        };

        return await createWithPost(retryPost);
      } catch (mirrorError) {
        console.error(`[Instagram] Mirror fallback failed: ${mirrorError?.message || mirrorError}`);
      }
    }

    const errorMsg = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.data?.error?.code;
    const fullError = error.response?.data?.error;
    
    console.error(`[Instagram] Container creation FAILED`);
    console.error(`  Error Code: ${errorCode || "N/A"}`);
    console.error(`  Error Message: ${errorMsg}`);
    console.error(`  Post Type: ${post.postType}`);
    console.error(`  Media URL: ${post.mediaUrl.substring(0, 100)}`);
    if (fullError) {
      console.error(`  Full Error:`, JSON.stringify(fullError, null, 2));
    }
    
    throw new Error(errorMsg || "Failed to create Instagram media container");
  }
}

export async function publishMedia(creationId) {
  try {
    const { data } = await graphApi.post(`/${env.instagramUserId}/media_publish`, null, {
      params: {
        creation_id: creationId,
        access_token: env.instagramAccessToken
      }
    });

    if (!data?.id) {
      throw new Error("Instagram media publish failed");
    }

    return data.id;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error("Media publish error:", errorMsg);
    throw new Error(errorMsg || "Failed to publish Instagram media");
  }
}

export async function getPublishedMediaDetails(mediaId) {
  if (!mediaId) {
    return null;
  }

  const { data } = await graphApi.get(`/${mediaId}`, {
    params: {
      fields: "id,media_type,media_product_type,permalink,timestamp",
      access_token: env.instagramAccessToken
    }
  });

  return data || null;
}

export async function publishPost(post) {
  const preparedPost = await normalizeReelMedia(post);
  let { creationId, mediaUrl } = await createMediaContainer(preparedPost);

  try {
    await waitForContainerReady(creationId, preparedPost.postType);
  } catch (error) {
    if (preparedPost.postType !== "reel" || !isInstagramProcessingFetchError(error)) {
      throw error;
    }

    const token = String(preparedPost._id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
    console.warn(`[Instagram] Reel processing failed; trying mirror retry for ${String(mediaUrl || "").substring(0, 80)}`);

    const mirroredUrl = await mirrorMediaToPublicUrl(mediaUrl || preparedPost.mediaUrl, token);
    const retryPost = {
      ...toPlainPost(preparedPost),
      postType: preparedPost.postType,
      mediaUrl: mirroredUrl
    };

    const retry = await createMediaContainer(retryPost);

    creationId = retry.creationId;
    mediaUrl = retry.mediaUrl;
    await waitForContainerReady(creationId, preparedPost.postType);
  }

  const publishId = await publishMedia(creationId);
  const publishedDetails = await getPublishedMediaDetails(publishId).catch(() => null);

  if (preparedPost.postType === "reel") {
    const mediaType = String(publishedDetails?.media_type || "").toUpperCase();
    const mediaProductType = String(publishedDetails?.media_product_type || "").toUpperCase();

    if (mediaType !== "VIDEO" || mediaProductType !== "REELS") {
      throw new Error(
        `Instagram published this as ${mediaType || "UNKNOWN"}/${mediaProductType || "UNKNOWN"}, not a reel video.`
      );
    }
  }

  return {
    creationId,
    publishId,
    mediaUrl: mediaUrl || preparedPost.mediaUrl,
    publishedDetails
  };
}
