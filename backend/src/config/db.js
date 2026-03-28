import mongoose from "mongoose";
import dns from "node:dns";
import { env } from "./env.js";

const DEFAULT_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"];

function isSrvDnsError(error) {
  if (!error) {
    return false;
  }

  const text = String(error.message || "");
  return error.code === "ECONNREFUSED" && (error.syscall === "querySrv" || text.includes("querySrv"));
}

function getDnsFallbackServers() {
  const raw = String(process.env.MONGODB_DNS_FALLBACK || "").trim();
  if (!raw) {
    return DEFAULT_DNS_SERVERS;
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function connectDatabase() {
  const options = {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10
  };

  try {
    await mongoose.connect(env.mongodbUri, options);
    console.log("MongoDB connected");
    return;
  } catch (error) {
    if (!env.mongodbUri.startsWith("mongodb+srv://") || !isSrvDnsError(error)) {
      throw error;
    }

    const dnsServers = getDnsFallbackServers();
    dns.setServers(dnsServers);
    console.warn(
      `MongoDB SRV lookup failed (${error.code}). Retrying with DNS fallback servers: ${dnsServers.join(", ")}`
    );

    await mongoose.connect(env.mongodbUri, options);
    console.log("MongoDB connected (after DNS fallback)");
  }
}
