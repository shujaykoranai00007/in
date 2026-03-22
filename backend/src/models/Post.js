import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    mediaUrl: {
      type: String,
      required: true,
      trim: true
    },
    caption: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2200
    },
    keywords: {
      type: [String],
      default: []
    },
    hashtags: {
      type: [String],
      default: []
    },
    driveFileId: {
      type: String,
      default: null
    },
    sourcePlatform: {
      type: String,
      enum: ["manual", "reddit"],
      default: "manual"
    },
    sourceId: {
      type: String,
      default: null,
      index: true
    },
    sourceUrl: {
      type: String,
      default: null
    },
    localMediaPath: {
      type: String,
      default: null
    },
    isTemporaryMedia: {
      type: Boolean,
      default: false
    },
    postType: {
      type: String,
      enum: ["reel", "post"],
      required: true
    },
    scheduledTime: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["pending", "processing", "posted", "failed"],
      default: "pending",
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    postedAt: {
      type: Date,
      default: null
    },
    instagramCreationId: {
      type: String,
      default: null
    },
    instagramPublishId: {
      type: String,
      default: null
    },
    instagramMediaType: {
      type: String,
      default: ""
    },
    instagramMediaProductType: {
      type: String,
      default: ""
    },
    instagramPermalink: {
      type: String,
      default: ""
    },
    errorLog: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

postSchema.index({ status: 1, scheduledTime: 1 });
postSchema.index({ sourcePlatform: 1, sourceId: 1 });

export const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
