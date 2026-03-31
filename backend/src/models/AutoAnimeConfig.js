import mongoose from "mongoose";

const TIME_SLOT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const autoAnimeConfigSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: "default"
    },
    enabled: {
      type: Boolean,
      default: false
    },
    sourcePlatform: {
      type: String,
      enum: ["reddit", "instagram"],
      default: "reddit"
    },
    contentType: {
      type: String,
      enum: ["reel", "post", "both"],
      default: "both"
    },
    randomMode: {
      type: Boolean,
      default: true
    },
    subreddits: {
      type: [String],
      default: ["Animeedits", "AnimeMusicVideos", "anime_edits", "anime"]
    },
    instagramAccounts: {
      type: [String],
      default: ["anime_edits", "amv_community", "anime_vibes", "amv.hub", "animeedits_daily"]
    },
    keywords: {
      type: [String],
      default: []
    },
    minScore: {
      type: Number,
      default: 20,
      min: 0
    },
    minWidth: {
      type: Number,
      default: 720,
      min: 240
    },
    maxAgeHours: {
      type: Number,
      default: 72,
      min: 1,
      max: 720
    },
    captionTemplate: {
      type: String,
      default: "{{title}}\n\n#anime #edit #reels"
    },
    hashtagSets: {
      type: [String],
      default: [
        "#AnimeEdit #AnimeReels #AMV #EditCommunity #ReelsInstagram #ExplorePage",
        "#AnimeLovers #AnimeClips #OtakuVibes #TrendingReels #ViralEdits #ForYou",
        "#AnimeScene #AnimeMoments #ReelKaroFeelKaro #WatchTillEnd #SaveAndShare #AnimeDaily"
      ]
    },
    hashtagSetCursor: {
      type: Number,
      default: 0
    },
    keywordSets: {
      type: [String],
      default: [
        "anime edit, anime reels, amv edit, otaku vibes, trending anime",
        "anime moments, best anime scene, fan edit, anime community, viral anime edit",
        "cinematic anime edit, emotional anime clip, anime lovers, anime shorts, anime aesthetic"
      ]
    },
    keywordSetCursor: {
      type: Number,
      default: 0
    },
    timeSlots: {
      type: [String],
      default: ["09:00", "12:30", "18:00"],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0 && value.every((slot) => TIME_SLOT_PATTERN.test(slot));
        },
        message: "timeSlots must contain HH:mm values"
      }
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata"
    },
    lastRunBySlot: {
      type: Map,
      of: String,
      default: {}
    },
    recentSourceIds: {
      type: [String],
      default: []
    },
    continuousSearchEnabled: {
      type: Boolean,
      default: false
    },
    continuousSearchContentType: {
      type: String,
      enum: ["reel", "post", "both"],
      default: "reel"
    },
    continuousSearchRequestedAt: {
      type: Date,
      default: null
    },
    continuousSearchLastAttemptAt: {
      type: Date,
      default: null
    },
    lastRunStatus: {
      type: String,
      enum: ["idle", "searching", "preparing", "success", "failed"],
      default: "idle"
    },
    lastRunMessage: {
      type: String,
      default: ""
    },
    lastRunAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export const AutoAnimeConfig =
  mongoose.models.AutoAnimeConfig ||
  mongoose.model("AutoAnimeConfig", autoAnimeConfigSchema);
