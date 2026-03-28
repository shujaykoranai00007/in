import { google } from "googleapis";
import fs from "fs";
import { env } from "../config/env.js";

const oauth2Client = new google.auth.OAuth2(
  env.googleClientId,
  env.googleClientSecret
);

oauth2Client.setCredentials({ refresh_token: env.googleRefreshToken });

const drive = google.drive({ version: "v3", auth: oauth2Client });

const mediaFolders = {
  reel: "reels",
  post: "posts"
};

async function findSubfolderId(parentFolderId, subfolderName) {
  const query = [
    `'${parentFolderId}' in parents`,
    `name = '${subfolderName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false"
  ].join(" and ");

  const { data } = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    pageSize: 1
  });

  return data.files?.[0]?.id || null;
}

function toPublicMediaUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export async function uploadFile(filePath, fileName, postType = "reel") {
  try {
    const folderName = mediaFolders[postType];
    if (!folderName) {
      throw new Error(`Invalid post type for Drive upload: ${postType}`);
    }

    // Find or create the post-type subfolder
    const folderId = await findOrCreateFolder(env.googleDriveFolderId, folderName);
    if (!folderId) {
      throw new Error(`Could not find or create ${folderName} folder on Google Drive`);
    }

    console.log(`[GOOGLE DRIVE] Uploading ${fileName} to folder ${folderName}...`);

    // Upload file to Drive
    const { data } = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: "application/octet-stream",
        parents: [folderId]
      },
      media: {
        mimeType: "video/mp4",
        body: fs.createReadStream(filePath)
      },
      fields: "id, webViewLink"
    });

    console.log(`[GOOGLE DRIVE] ✅ Upload successful: ${data.id}`);

    // Share file publicly
    await drive.permissions.create({
      fileId: data.id,
      requestBody: {
        role: "reader",
        type: "anyone"
      }
    });

    console.log(`[GOOGLE DRIVE] ✅ File shared publicly`);

    return {
      fileId: data.id,
      mediaUrl: toPublicMediaUrl(data.id),
      webViewLink: data.webViewLink
    };
  } catch (error) {
    console.error(`[GOOGLE DRIVE] ❌ Upload failed:`, error?.message || error);
    throw error;
  }
}

async function findOrCreateFolder(parentFolderId, folderName) {
  try {
    // Try to find existing folder
    const existing = await findSubfolderId(parentFolderId, folderName);
    if (existing) {
      return existing;
    }

    // Create new folder if not found
    console.log(`[GOOGLE DRIVE] Creating folder: ${folderName}`);
    const { data } = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId]
      },
      fields: "id"
    });

    console.log(`[GOOGLE DRIVE] ✅ Folder created: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error(`[GOOGLE DRIVE] ❌ Folder operation failed:`, error?.message || error);
    throw error;
  }
}

export async function listMediaFiles(postType) {
  const folderName = mediaFolders[postType];
  if (!folderName) {
    throw new Error("Invalid post type for Drive lookup");
  }

  const folderId = await findSubfolderId(env.googleDriveFolderId, folderName);
  if (!folderId) {
    return [];
  }

  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink)",
    pageSize: 100,
    orderBy: "createdTime desc"
  });

  return (data.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    previewUrl: file.webViewLink,
    mediaUrl: toPublicMediaUrl(file.id)
  }));
}
