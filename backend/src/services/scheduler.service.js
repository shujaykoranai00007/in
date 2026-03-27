import { Post } from "../models/Post.js";
import { publishPost } from "./instagram.service.js";
import { cleanupPostLocalMedia } from "./media-cleanup.service.js";

const MAX_RETRIES = 3;
const PROCESSING_STALE_MINUTES = 8;
const REEL_WAIT_RETRY_MINUTES = 1;
const RETRY_GAP_SECONDS = Math.max(15, Number(process.env.UPLOAD_RETRY_GAP_SECONDS) || 60);

function isReelStillProcessingError(error) {
  return (
    error?.code === "REEL_STILL_PROCESSING" ||
    String(error?.message || "").toLowerCase().includes("reel is still processing")
  );
}

function isTunnelOrUrlError(error) {
  const msg = String(error?.message || "").toLowerCase();
  const errorCode = error?.response?.data?.error?.code;
  
  // Error 2207076 = Instagram media processing failed (usually URL unreachable or format issue)
  // Error 2207076 is non-retryable - need setup fix
  if (errorCode === 2207076 || msg.includes("2207076")) {
    return true;
  }
  
  if (
    msg.includes("reach") ||
    msg.includes("tunnel") ||
    msg.includes("publicly reachable") ||
    msg.includes("public url")
  ) {
    return true;
  }
  
  return false;
}

function isRetryableInstagramError(error) {
  const msg = String(error?.message || "").toLowerCase();
  const errorCode = error?.response?.data?.error?.code;

  // Non-retryable errors:
  if (
    msg.includes("invalid") ||
    msg.includes("only photo or video can be accepted") ||
    msg.includes("unsupported") ||
    isTunnelOrUrlError(error)
  ) {
    return false;
  }

  return true;
}

function extractFailureMessage(error) {
  const responseError = error?.response?.data?.error;
  if (responseError?.message) {
    const codeText = responseError.code ? ` (code ${responseError.code})` : "";
    return `${responseError.message}${codeText}`;
  }

  const responseData = error?.response?.data;
  if (typeof responseData === "string" && responseData.trim()) {
    return responseData.length > 500 ? `${responseData.slice(0, 500)}...` : responseData;
  }

  const fallback = String(error?.message || "Unknown upload error").trim();
  return fallback.length > 500 ? `${fallback.slice(0, 500)}...` : fallback;
}

async function uploadOnce(post) {
  try {
    const result = await publishPost(post);
    return { success: true, result };
  } catch (error) {
    if (isReelStillProcessingError(error)) {
      return { success: false, pending: true, error };
    }

    return { success: false, error };
  }
}

async function recoverStaleProcessingPosts() {
  const staleTime = new Date(Date.now() - PROCESSING_STALE_MINUTES * 60 * 1000);

  await Post.updateMany(
    { status: "processing", updatedAt: { $lte: staleTime } },
    {
      $set: {
        status: "failed",
        errorLog: "Marked as failed: processing timeout"
      }
    }
  );
}

async function processLockedPost(lockedPost) {
  const uploadResult = await uploadOnce(lockedPost);
  const nextAttempts = Number(lockedPost.attempts || 0) + 1;

  if (uploadResult.success) {
    const successUpdate = {
      status: "posted",
      postedAt: new Date(),
      instagramCreationId: uploadResult.result.creationId,
      instagramPublishId: uploadResult.result.publishId || "",
      instagramMediaType: uploadResult.result.publishedDetails?.media_type || "",
      instagramMediaProductType: uploadResult.result.publishedDetails?.media_product_type || "",
      instagramPermalink: uploadResult.result.publishedDetails?.permalink || "",
      attempts: nextAttempts,
      errorLog: ""
    };

    if (uploadResult.result.mediaUrl) {
      successUpdate.mediaUrl = uploadResult.result.mediaUrl;
    }

    await Post.updateOne(
      { _id: lockedPost._id },
      {
        $set: successUpdate
      }
    );

    try {
      const cleanup = await cleanupPostLocalMedia(lockedPost);
      if (cleanup.removed) {
        await Post.updateOne(
          { _id: lockedPost._id },
          {
            $set: {
              localMediaPath: null,
              isTemporaryMedia: false,
              localMediaDeletedAt: new Date()
            }
          }
        );
      }
    } catch (cleanupError) {
      console.error("Local media cleanup failed for post", lockedPost._id, cleanupError);
    }

    return;
  }

  if (uploadResult.pending) {
    await Post.updateOne(
      { _id: lockedPost._id },
      {
        $set: {
          status: "pending",
          scheduledTime: new Date(Date.now() + REEL_WAIT_RETRY_MINUTES * 60 * 1000),
          attempts: lockedPost.attempts || 0,
          errorLog: ""
        }
      }
    );
    return;
  }

  const failureMessage = extractFailureMessage(uploadResult.error);

  // Build user-friendly error message
  let displayError = failureMessage;
  if (isTunnelOrUrlError(uploadResult.error)) {
    displayError = `Instagram could not download media. PUBLIC_BASE_URL must be publicly reachable. Set up a tunnel (ngrok.io, cloudflare, etc.) and update .env PUBLIC_BASE_URL. Error: ${failureMessage}`;
  }

  const shouldRetry = isRetryableInstagramError(uploadResult.error) && nextAttempts < MAX_RETRIES;

  if (shouldRetry) {
    await Post.updateOne(
      { _id: lockedPost._id },
      {
        $set: {
          status: "pending",
          scheduledTime: new Date(Date.now() + RETRY_GAP_SECONDS * 1000),
          attempts: nextAttempts,
          errorLog: ""
        }
      }
    );
    return;
  }

  await Post.updateOne(
    { _id: lockedPost._id },
    {
      $set: {
        status: "failed",
        attempts: nextAttempts,
        errorLog: displayError
      }
    }
  );
}

export async function processPostNow(postId) {
  if (!postId) {
    return { processed: false, reason: "missing-post-id" };
  }

  const lockedPost = await Post.findOneAndUpdate(
    { _id: postId, status: "pending" },
    { $set: { status: "processing" } },
    { new: true }
  );

  if (!lockedPost) {
    return { processed: false, reason: "not-pending" };
  }

  await processLockedPost(lockedPost);
  return { processed: true };
}

export async function processPendingPosts() {
  await recoverStaleProcessingPosts();

  const duePosts = await Post.find({
    status: "pending",
    scheduledTime: { $lte: new Date() }
  })
    .sort({ scheduledTime: 1 })
    .limit(20)
    .lean();

  for (const duePost of duePosts) {
    const lockedPost = await Post.findOneAndUpdate(
      { _id: duePost._id, status: "pending" },
      { $set: { status: "processing" } },
      { new: true }
    );

    if (!lockedPost) {
      continue;
    }
    await processLockedPost(lockedPost);
  }
}
