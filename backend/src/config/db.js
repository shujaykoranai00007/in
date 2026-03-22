import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  await mongoose.connect(env.mongodbUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10
  });
  console.log("MongoDB connected");
}
