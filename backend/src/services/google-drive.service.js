import { google } from "googleapis";
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
