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
    driveFileId: {
      type: String,
      default: null
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
    errorLog: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

postSchema.index({ status: 1, scheduledTime: 1 });

export const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
