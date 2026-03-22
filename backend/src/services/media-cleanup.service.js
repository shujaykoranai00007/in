import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");

function isInsideUploads(candidatePath) {
  if (!candidatePath) {
    return false;
  }

  const normalizedBase = path.resolve(uploadsDir) + path.sep;
  const normalizedTarget = path.resolve(candidatePath);
  return normalizedTarget.startsWith(normalizedBase);
}

function filePathFromMediaUrl(mediaUrl) {
  try {
    const parsed = new URL(mediaUrl);
    if (!parsed.pathname.startsWith("/media/")) {
      return null;
    }

    const filename = path.basename(parsed.pathname);
    if (!filename) {
      return null;
    }

    return path.resolve(uploadsDir, filename);
  } catch {
    return null;
  }
}

export function resolvePostLocalMediaPath(post) {
  const localPath = post?.localMediaPath ? path.resolve(post.localMediaPath) : null;
  if (localPath && isInsideUploads(localPath)) {
    return localPath;
  }

  const pathFromUrl = filePathFromMediaUrl(post?.mediaUrl || "");
  if (pathFromUrl && isInsideUploads(pathFromUrl)) {
    return pathFromUrl;
  }

  return null;
}

export async function cleanupPostLocalMedia(post) {
  const filePath = resolvePostLocalMediaPath(post);
  if (!filePath) {
    return { removed: false, bytesFreed: 0 };
  }

  try {
    const stats = await fs.promises.stat(filePath);
    await fs.promises.unlink(filePath);
    return {
      removed: true,
      bytesFreed: Number(stats?.size || 0)
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { removed: false, bytesFreed: 0 };
    }

    throw error;
  }
}
