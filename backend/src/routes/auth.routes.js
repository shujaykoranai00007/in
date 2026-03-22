import { Router } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import { env } from "../config/env.js";
import { authMiddleware } from "../middleware/auth.js";

export const authRouter = Router();

const graphApi = axios.create({
  baseURL: "https://graph.facebook.com/v19.0",
  timeout: 15000
});

function getInsightMetricValue(insightData = []) {
  if (!Array.isArray(insightData) || !insightData.length) {
    return 0;
  }

  const values = insightData[0]?.values;
  if (!Array.isArray(values) || !values.length) {
    return 0;
  }

  const first = values[0]?.value;

  if (typeof first === "number") {
    return first;
  }

  if (first && typeof first === "object" && typeof first.value === "number") {
    return first.value;
  }

  return 0;
}

async function fetchMediaInsights(mediaId, mediaType) {
  const metrics = ["impressions", "reach", "saved", "total_interactions"];
  if (mediaType === "VIDEO" || mediaType === "REEL") {
    metrics.push("video_views", "plays");
  }

  try {
    const { data } = await graphApi.get(`/${mediaId}/insights`, {
      params: {
        metric: metrics.join(","),
        access_token: env.instagramAccessToken
      }
    });

    const mapped = {};
    for (const row of data?.data || []) {
      mapped[row?.name] = getInsightMetricValue([row]);
    }

    return mapped;
  } catch {
    return {};
  }
}

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (email !== env.adminEmail || password !== env.adminPassword) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      sub: email,
      role: "admin"
    },
    env.jwtSecret,
    { expiresIn: "12h" }
  );

  return res.json({ token, user: { email, role: "admin" } });
});

authRouter.get("/me", authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

// Validate Instagram token status
authRouter.get("/instagram-token-status", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(`https://graph.facebook.com/v19.0/${env.instagramUserId}`, {
      params: {
        fields: "id,username",
        access_token: env.instagramAccessToken
      },
      timeout: 5000
    });

    return res.json({
      valid: true,
      userId: response.data.id,
      username: response.data.username
    });
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error("Instagram token validation error:", errorMsg);
    
    return res.status(401).json({
      valid: false,
      error: errorMsg || "Invalid Instagram access token"
    });
  }
});

authRouter.get("/instagram-account-details", authMiddleware, async (_req, res) => {
  try {
    const [profileResp, accountInsightsResp, mediaResp] = await Promise.all([
      graphApi.get(`/${env.instagramUserId}`, {
        params: {
          fields:
            "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website",
          access_token: env.instagramAccessToken
        }
      }),
      graphApi
        .get(`/${env.instagramUserId}/insights`, {
          params: {
            metric: "impressions,reach,profile_views,website_clicks",
            period: "day",
            access_token: env.instagramAccessToken
          }
        })
        .catch(() => ({ data: { data: [] } })),
      graphApi.get(`/${env.instagramUserId}/media`, {
        params: {
          fields:
            "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
          limit: 12,
          access_token: env.instagramAccessToken
        }
      })
    ]);

    const mediaItems = mediaResp?.data?.data || [];

    const mediaWithInsights = await Promise.all(
      mediaItems.map(async (item) => {
        const insights = await fetchMediaInsights(item.id, item.media_type);
        return {
          id: item.id,
          caption: item.caption || "",
          mediaType: item.media_type,
          mediaUrl: item.media_url || item.thumbnail_url || "",
          permalink: item.permalink || "",
          timestamp: item.timestamp,
          likeCount: item.like_count || 0,
          commentCount: item.comments_count || 0,
          views: insights.video_views || insights.plays || 0,
          impressions: insights.impressions || 0,
          reach: insights.reach || 0,
          saves: insights.saved || 0,
          interactions: insights.total_interactions || 0
        };
      })
    );

    const totals = mediaWithInsights.reduce(
      (acc, item) => {
        acc.likes += item.likeCount;
        acc.comments += item.commentCount;
        acc.views += item.views;
        acc.impressions += item.impressions;
        acc.reach += item.reach;
        acc.saves += item.saves;
        acc.interactions += item.interactions;
        return acc;
      },
      {
        likes: 0,
        comments: 0,
        views: 0,
        impressions: 0,
        reach: 0,
        saves: 0,
        interactions: 0
      }
    );

    const accountInsights = {};
    for (const row of accountInsightsResp?.data?.data || []) {
      accountInsights[row?.name] = getInsightMetricValue([row]);
    }

    return res.json({
      account: {
        id: profileResp.data.id,
        username: profileResp.data.username,
        name: profileResp.data.name || "",
        biography: profileResp.data.biography || "",
        website: profileResp.data.website || "",
        profilePictureUrl: profileResp.data.profile_picture_url || "",
        followersCount: profileResp.data.followers_count || 0,
        followsCount: profileResp.data.follows_count || 0,
        mediaCount: profileResp.data.media_count || 0
      },
      accountInsights,
      totals,
      recentMedia: mediaWithInsights,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    return res.status(500).json({
      message: errorMsg || "Failed to fetch Instagram account details"
    });
  }
});
