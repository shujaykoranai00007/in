import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Film,
  Image,
  Link2,
  LogOut,
  Plus,
  Trash2,
  Upload
} from "lucide-react";
import api from "../services/api";
import Sidebar from "./Sidebar";

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value));
}

export default function DashboardView({ user, onLogout, instagramStatus }) {
  const POLL_INTERVAL_MS = 10000;
  const TOAST_TTL_MS = 12000;
  const MAX_ACTIVITY_ITEMS = 20;

  const [autoAnimeConfig, setAutoAnimeConfig] = useState(null);
  const [autoAnimeLoading, setAutoAnimeLoading] = useState(false);
  const [autoAnimeSaving, setAutoAnimeSaving] = useState(false);
  const [autoAnimeRunning, setAutoAnimeRunning] = useState(false);
  const [autoAnimeMessage, setAutoAnimeMessage] = useState("");
  const [newTimeSlot, setNewTimeSlot] = useState("");

  const [theme, setTheme] = useState("aurora");
  const [activeTab, setActiveTab] = useState("schedule");
  const [postType, setPostType] = useState("reel");
  const [caption, setCaption] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [autoGenerateText, setAutoGenerateText] = useState(true);
  const [generatedKeywords, setGeneratedKeywords] = useState([]);
  const [generatedHashtags, setGeneratedHashtags] = useState([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [pendingPosts, setPendingPosts] = useState([]);
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [toasts, setToasts] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [desktopNotificationPermission, setDesktopNotificationPermission] = useState(() => {
    if (typeof window === "undefined" || typeof window.Notification === "undefined") {
      return "unsupported";
    }

    return window.Notification.permission;
  });
  const [instagramDetails, setInstagramDetails] = useState(null);
  const [instagramDetailsLoading, setInstagramDetailsLoading] = useState(false);
  const [instagramDetailsError, setInstagramDetailsError] = useState("");
  const previousStatusByIdRef = useRef(new Map());
  const hasHydratedStatusesRef = useRef(false);

  // Instagram URL extraction
  const [inputMode, setInputMode] = useState("upload"); // "upload" | "direct" | "instagram"
  const [instagramUrl, setInstagramUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [autoPostingFromLink, setAutoPostingFromLink] = useState(false);
  const [extractError, setExtractError] = useState("");

  function getPostLabel(post = {}) {
    if (post.postType === "reel") {
      return "Reel";
    }

    if (post.postType === "post") {
      return "Post";
    }

    return "Post";
  }

  function addActivityEvent({ tone = "info", title, description = "", postId = "" }) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const event = {
      id,
      tone,
      title,
      description,
      postId,
      createdAt: new Date().toISOString()
    };

    setActivityFeed((prev) => [event, ...prev].slice(0, MAX_ACTIVITY_ITEMS));
    setToasts((prev) => [event, ...prev].slice(0, 4));

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, TOAST_TTL_MS);

    if (
      desktopNotificationPermission === "granted" &&
      typeof window !== "undefined" &&
      typeof window.Notification !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      new window.Notification(title, {
        body: description || title
      });
    }
  }

  async function requestDesktopNotifications() {
    if (typeof window === "undefined" || typeof window.Notification === "undefined") {
      return;
    }

    const permission = await window.Notification.requestPermission();
    setDesktopNotificationPermission(permission);

    if (permission === "granted") {
      addActivityEvent({
        tone: "success",
        title: "Desktop alerts enabled",
        description: "You will get alerts when queued posts change status."
      });
    }
  }

  const stats = useMemo(
    () => [
      {
        label: "Pending",
        value: pendingPosts.filter((p) => ["pending", "processing"].includes(p.status)).length,
        icon: Clock3,
        tone: "text-amber-300"
      },
      {
        label: "Posted",
        value: history.filter((p) => p.status === "posted").length,
        icon: CheckCircle2,
        tone: "text-emerald-300"
      },
      {
        label: "Failed",
        value: history.filter((p) => p.status === "failed").length,
        icon: AlertTriangle,
        tone: "text-red-300"
      }
    ],
    [pendingPosts, history]
  );

  async function loadPosts({ silent = false } = {}) {
    try {
      const [{ data: pending }, { data: allHistory }] = await Promise.all([
        api.get("/posts?status=pending,processing&limit=200"),
        api.get("/posts/history")
      ]);
      setPendingPosts(pending);
      setHistory(allHistory);
    } catch (error) {
      if (!silent) {
        setMessage(error?.response?.data?.message || "Failed to load posts.");
      }
    }
  }

  async function loadAutoAnimeConfig({ silent = false } = {}) {
    if (!silent) {
      setAutoAnimeLoading(true);
    }

    try {
      const { data } = await api.get("/auto-anime");
      setAutoAnimeConfig(data);
    } catch (error) {
      if (!silent) {
        setAutoAnimeMessage(error?.response?.data?.message || "Failed to load anime automation settings.");
      }
    } finally {
      if (!silent) {
        setAutoAnimeLoading(false);
      }
    }
  }

  function updateAutoAnimeField(field, value) {
    setAutoAnimeConfig((prev) => ({ ...(prev || {}), [field]: value }));
  }

  function addTimeSlot() {
    if (!newTimeSlot || !autoAnimeConfig) {
      return;
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(newTimeSlot)) {
      setAutoAnimeMessage("Use HH:mm format for time slots (example: 09:00).");
      return;
    }

    const nextSlots = [...new Set([...(autoAnimeConfig.timeSlots || []), newTimeSlot])].sort();
    updateAutoAnimeField("timeSlots", nextSlots);
    setNewTimeSlot("");
    setAutoAnimeMessage("");
  }

  function removeTimeSlot(slot) {
    if (!autoAnimeConfig) {
      return;
    }

    const nextSlots = (autoAnimeConfig.timeSlots || []).filter((item) => item !== slot);
    updateAutoAnimeField("timeSlots", nextSlots);
  }

  async function saveAutoAnimeConfig() {
    if (!autoAnimeConfig) {
      return;
    }

    setAutoAnimeSaving(true);
    setAutoAnimeMessage("");

    try {
      const hashtagSetsText = Array.isArray(autoAnimeConfig.hashtagSets)
        ? autoAnimeConfig.hashtagSets.join("\n")
        : String(autoAnimeConfig.hashtagSets || "");
      const keywordSetsText = Array.isArray(autoAnimeConfig.keywordSets)
        ? autoAnimeConfig.keywordSets.join("\n")
        : String(autoAnimeConfig.keywordSets || "");

      const payload = {
        ...autoAnimeConfig,
        subreddits: String(autoAnimeConfig.subreddits || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        keywords: String(autoAnimeConfig.keywords || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        hashtagSets: hashtagSetsText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        keywordSets: keywordSetsText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        timeSlots: (autoAnimeConfig.timeSlots || []).filter(Boolean)
      };

      const { data } = await api.patch("/auto-anime", payload);
      setAutoAnimeConfig(data);
      setAutoAnimeMessage("Anime automation settings saved.");
    } catch (error) {
      setAutoAnimeMessage(error?.response?.data?.message || "Could not save anime automation settings.");
    } finally {
      setAutoAnimeSaving(false);
    }
  }

  async function runAutoAnimeNow() {
    setAutoAnimeRunning(true);
    setAutoAnimeMessage("");
    try {
      const { data } = await api.post("/auto-anime/run-now", {
        contentType: autoAnimeConfig?.contentType || "both"
      });
      if (data.queued) {
        setAutoAnimeMessage(`Queued ${data.postType || "reel"} from r/${data.subreddit}: ${data.title}`);
        addActivityEvent({
          tone: "info",
          title: `${String(data.postType || "reel").toUpperCase()} queued from auto anime`,
          description: data.title ? `${data.title}` : "Auto anime added new content to queue."
        });
        await loadPosts();
      } else {
        setAutoAnimeMessage(data.message || "No matching anime content was found this time.");
      }
    } catch (error) {
      setAutoAnimeMessage(error?.response?.data?.message || "Failed to run anime automation now.");
    } finally {
      setAutoAnimeRunning(false);
    }
  }

  useEffect(() => {
    loadPosts();
    loadAutoAnimeConfig();
  }, []);

  async function loadInstagramDetails({ silent = false } = {}) {
    if (!silent) {
      setInstagramDetailsLoading(true);
      setInstagramDetailsError("");
    }

    try {
      const { data } = await api.get("/auth/instagram-account-details");
      setInstagramDetails(data);
    } catch (error) {
      setInstagramDetails(null);
      if (!silent) {
        setInstagramDetailsError(
          error?.response?.data?.message ||
            "Could not fetch Instagram account details. Check token permissions."
        );
      }
    } finally {
      if (!silent) {
        setInstagramDetailsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (instagramStatus?.valid) {
      loadInstagramDetails();
    }
  }, [instagramStatus?.valid]);

  useEffect(() => {
    const combinedPosts = [...pendingPosts, ...history];
    const currentStatusById = new Map(combinedPosts.map((post) => [post._id, post.status]));

    if (!hasHydratedStatusesRef.current) {
      previousStatusByIdRef.current = currentStatusById;
      hasHydratedStatusesRef.current = true;
      return;
    }

    for (const post of combinedPosts) {
      const previousStatus = previousStatusByIdRef.current.get(post._id);

      if (!previousStatus) {
        if (["pending", "processing"].includes(post.status)) {
          addActivityEvent({
            tone: "info",
            title: `${getPostLabel(post)} queued`,
            description: `Scheduled for ${formatDate(post.scheduledTime)}`,
            postId: post._id
          });
        }
        continue;
      }

      if (previousStatus === post.status) {
        continue;
      }

      if (post.status === "processing") {
        addActivityEvent({
          tone: "info",
          title: `${getPostLabel(post)} uploading`,
          description: "Instagram upload process started.",
          postId: post._id
        });
      }

      if (post.status === "posted") {
        addActivityEvent({
          tone: "success",
          title: `${getPostLabel(post)} posted`,
          description: "Your content was published successfully.",
          postId: post._id
        });
      }

      if (post.status === "failed") {
        addActivityEvent({
          tone: "danger",
          title: `${getPostLabel(post)} failed`,
          description: post.errorLog || "Instagram rejected this upload.",
          postId: post._id
        });
      }

      if (post.status === "pending" && previousStatus === "processing") {
        addActivityEvent({
          tone: "warn",
          title: `${getPostLabel(post)} re-queued`,
          description: "Still processing on Instagram. Auto-retrying shortly.",
          postId: post._id
        });
      }
    }

    previousStatusByIdRef.current = currentStatusById;
  }, [history, pendingPosts]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      loadPosts({ silent: true });

      if (activeTab === "animeAutomation") {
        loadAutoAnimeConfig({ silent: true });
      }

      if (activeTab === "insights" && instagramStatus?.valid) {
        loadInstagramDetails({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeTab, instagramStatus?.valid]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  async function submitSchedule(event) {
    event.preventDefault();
    if (!mediaUrl && !mediaFile) {
      setMessage("Upload a file or enter media URL before submitting.");
      return;
    }

    if (!scheduledTime) {
      setMessage("Select schedule time before submitting.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      let finalMediaUrl = mediaUrl;
      let finalCaption = caption;
      let finalKeywords = generatedKeywords;
      let finalHashtags = generatedHashtags;

      if (mediaFile) {
        const formData = new FormData();
        formData.append("media", mediaFile);
        let uploadResponse;
        try {
          uploadResponse = await api.post("/uploads/media", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
        } catch (uploadError) {
          const uploadMessage =
            uploadError?.response?.data?.message ||
            "Upload failed. Use MP4, MOV, JPG, PNG, or WEBP and try again.";
          setMessage(`Upload failed: ${uploadMessage}`);
          return;
        }
        finalMediaUrl = uploadResponse.data.mediaUrl;
      }

      if (autoGenerateText) {
        const seedText = mediaFile?.name || instagramUrl || finalMediaUrl;
        const { data: generated } = await api.post("/posts/generate-upload-text", {
          postType,
          seedText,
          existingCaption: finalCaption
        });

        finalCaption = generated.caption;
        finalKeywords = generated.keywords || [];
        finalHashtags = generated.hashtags || [];
        setCaption(generated.caption || "");
        setGeneratedKeywords(generated.keywords || []);
        setGeneratedHashtags(generated.hashtags || []);
      }

      if (inputMode === "instagram" && !mediaFile) {
        if (!instagramUrl.trim()) {
          setMessage("Enter Instagram URL before submitting.");
          return;
        }

        const { data } = await api.post("/posts/from-link/schedule", {
          sourceUrl: instagramUrl.trim(),
          caption: finalCaption,
          keywords: finalKeywords,
          hashtags: finalHashtags,
          scheduledTime,
          postType
        });

        finalMediaUrl = data?.post?.mediaUrl || "";
      } else {
        await api.post("/posts", {
          mediaUrl: finalMediaUrl,
          caption: finalCaption,
          keywords: finalKeywords,
          hashtags: finalHashtags,
          postType,
          scheduledTime
        });
      }

      setMediaFile(null);
      setMediaPreview("");
      setMediaUrl("");
      setCaption("");
      setScheduledTime("");
      setGeneratedKeywords([]);
      setGeneratedHashtags([]);
      setInstagramUrl("");
      setExtractError("");
      if (String(finalMediaUrl).includes("localhost") || String(finalMediaUrl).includes("127.0.0.1")) {
        setMessage("Post scheduled. Note: localhost media URLs are not reachable by Instagram. Use a public URL/tunnel for successful posting.");
      } else {
        setMessage("Post scheduled successfully.");
      }
      addActivityEvent({
        tone: "info",
        title: `${postType === "reel" ? "Reel" : "Post"} queued`,
        description: `Scheduled for ${formatDate(scheduledTime)}`
      });
      await loadPosts();
      setActiveTab("pending");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Failed to schedule post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExtract() {
    if (!instagramUrl.trim()) return;
    setExtracting(true);
    setExtractError("");
    setMediaUrl("");
    try {
      const { data } = await api.post("/posts/extract-url", {
        sourceUrl: instagramUrl.trim(),
        postType
      });
      setMediaUrl(data.mediaUrl);
      setPostType((current) => (current === "reel" ? "reel" : data.postType));
      if (data.caption) setCaption(data.caption);
    } catch (err) {
      const rawMessage =
        err?.response?.data?.message ||
        (typeof err?.response?.data === "string" ? err.response.data : "") ||
        err?.message ||
        "";
      const fallback =
        "Instagram blocked extraction for this URL. Use Upload File (best) or Direct URL for reliable scheduling.";
      const friendlyMessage =
        rawMessage && !/unexpected server error/i.test(rawMessage) ? rawMessage : fallback;
      setExtractError(friendlyMessage);
    } finally {
      setExtracting(false);
    }
  }

  async function handleExtractAndAutoPost() {
    if (!instagramUrl.trim()) {
      return;
    }

    setAutoPostingFromLink(true);
    setExtractError("");
    setMessage("");

    try {
      const { data } = await api.post("/posts/from-link/auto", {
        sourceUrl: instagramUrl.trim(),
        caption: caption || undefined,
        postType
      });

      const posted = data?.post?.status === "posted";
      const typeLabel = data?.post?.postType === "reel" ? "Reel" : "Post";
      setMessage(
        posted
          ? `${typeLabel} auto-posted successfully.`
          : `${typeLabel} downloaded and queued for auto posting.`
      );

      addActivityEvent({
        tone: posted ? "success" : "info",
        title: posted ? `${typeLabel} posted` : `${typeLabel} queued`,
        description:
          data?.post?.status === "failed"
            ? data?.post?.errorLog || "Auto post failed."
            : "Link media downloaded and processing started."
      });

      if (data?.post?.mediaUrl) {
        setMediaUrl(data.post.mediaUrl);
      }

      await loadPosts();
      setActiveTab("pending");
    } catch (err) {
      setExtractError(err?.response?.data?.message || "Could not auto-post from this link.");
    } finally {
      setAutoPostingFromLink(false);
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setMediaFile(file);

    if (file) {
      if (mediaPreview && mediaPreview.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreview);
      }
      const preview = URL.createObjectURL(file);
      setMediaPreview(preview);
      setMediaUrl("");
      setExtractError("");
      setInstagramUrl("");
      if (file.type.startsWith("video/")) {
        setPostType("reel");
      } else if (file.type.startsWith("image/")) {
        setPostType("post");
      }
    } else {
      if (mediaPreview && mediaPreview.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreview);
      }
      setMediaPreview("");
    }
  }

  useEffect(() => {
    return () => {
      if (mediaPreview && mediaPreview.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  return (
    <div className="min-h-screen bg-grid px-4 pb-28 pt-4 text-slate-800 md:px-6 md:py-8 lg:pb-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_1fr]">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={onLogout}
          user={user}
        />

        <main className="space-y-5">
          <section className="glass-panel flex items-center justify-between rounded-2xl px-4 py-3 lg:hidden">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
                InstaFlow Pro
              </p>
              <p className="mt-0.5 text-sm font-semibold">@{instagramStatus?.username || "admin"}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="ghost-btn flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            >
              <LogOut size={14} />
              Logout
            </button>
          </section>

          {activeTab === "liveMonitor" && (
            <>
              <section className="glass-panel rounded-2xl px-4 py-4 md:px-5 md:py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="muted-text text-xs uppercase tracking-[0.18em]">Live Queue Monitor</p>
                    <h3 className="text-lg font-bold font-display">Real-time upload status alerts</h3>
                    <p className="muted-text mt-1 text-xs">Dedicated monitor screen for queue, upload, retry, success, and failure events.</p>
                  </div>
                  <button
                    type="button"
                    onClick={requestDesktopNotifications}
                    disabled={desktopNotificationPermission === "granted" || desktopNotificationPermission === "unsupported"}
                    className="ghost-btn px-3 py-2 text-xs disabled:opacity-60"
                  >
                    {desktopNotificationPermission === "granted"
                      ? "Desktop Alerts On"
                      : desktopNotificationPermission === "unsupported"
                        ? "Desktop Alerts Unsupported"
                        : "Enable Desktop Alerts"}
                  </button>
                </div>

                <div className="mt-4 grid gap-2">
                  {activityFeed.slice(0, 8).map((event) => (
                    <div
                      key={event.id}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        event.tone === "success"
                          ? "border-emerald-300/80 bg-emerald-100/80 text-emerald-900"
                          : event.tone === "danger"
                            ? "border-red-300/80 bg-red-100/80 text-red-900"
                            : event.tone === "warn"
                              ? "border-amber-300/80 bg-amber-100/80 text-amber-900"
                              : "border-cyan-300/80 bg-cyan-100/80 text-cyan-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{event.title}</p>
                          {event.description && <p className="mt-0.5 text-xs opacity-90">{event.description}</p>}
                        </div>
                        <p className="text-[11px] font-semibold opacity-70">{formatDate(event.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {!activityFeed.length && (
                    <p className="text-xs text-muted">No queue events yet. Schedule or auto-queue a reel/post to see live updates.</p>
                  )}
                </div>
              </section>

              <section className="glass-panel rounded-2xl p-4 md:p-5">
                <h3 className="text-base font-bold font-display">Queue Snapshot</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">Pending</p>
                    <p className="mt-1 text-2xl font-bold font-display text-amber-900">{pendingPosts.filter((p) => p.status === "pending").length}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-900">Processing</p>
                    <p className="mt-1 text-2xl font-bold font-display text-cyan-900">{pendingPosts.filter((p) => p.status === "processing").length}</p>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-900">Failed (History)</p>
                    <p className="mt-1 text-2xl font-bold font-display text-red-900">{history.filter((p) => p.status === "failed").length}</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab !== "liveMonitor" && (
            <section className="glass-panel fade-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-4 md:px-5">
            <div>
              <p className="muted-text text-xs uppercase tracking-[0.2em]">Control Center</p>
              <h3 className="text-lg font-bold font-display">Campaign Scheduler</h3>
              <p className="muted-text mt-1 text-xs">Manage upload source, schedule timing, and publishing health.</p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { key: "aurora", label: "Aurora" },
                { key: "sunset", label: "Sunset" },
                { key: "ocean", label: "Ocean" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTheme(item.key)}
                  className={`theme-chip rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    theme === item.key ? "active" : "text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
          )}

          {activeTab !== "liveMonitor" && (
            <section className="grid gap-4 md:grid-cols-3">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="glass-panel rounded-2xl p-4"
                >
                  <p className="text-sm text-muted">{item.label}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <h3 className="text-3xl font-bold font-display">{item.value}</h3>
                    <span className="status-pill">
                      <Icon className={item.tone} size={16} />
                    </span>
                  </div>
                </motion.article>
              );
            })}
          </section>
          )}

          {activeTab !== "liveMonitor" && instagramStatus?.valid && (
            <section className="glass-panel rounded-2xl border border-emerald-400/40 bg-emerald-100/75 px-4 py-3 text-sm text-emerald-900">
              Instagram token connected{instagramStatus.username ? ` as @${instagramStatus.username}` : ""}.
            </section>
          )}

          {activeTab === "insights" && instagramStatus?.valid && (
            <section className="glass-panel rounded-2xl p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="muted-text text-xs uppercase tracking-[0.18em]">Instagram Analytics</p>
                  <h3 className="text-xl font-bold font-display">Account Insights</h3>
                </div>
                <button
                  type="button"
                  onClick={loadInstagramDetails}
                  className="ghost-btn px-3 py-2 text-xs"
                  disabled={instagramDetailsLoading}
                >
                  {instagramDetailsLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {instagramDetailsError && (
                <p className="mt-3 rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {instagramDetailsError}
                </p>
              )}

              {instagramDetails && (
                <>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 sm:p-5">
                      <div className="flex items-center gap-3 sm:gap-4">
                        {instagramDetails.account?.profilePictureUrl ? (
                          <img
                            src={instagramDetails.account.profilePictureUrl}
                            alt="Instagram profile"
                            className="h-14 w-14 rounded-full border border-slate-200 object-cover sm:h-16 sm:w-16"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold sm:h-16 sm:w-16">
                            IG
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">@{instagramDetails.account?.username || "unknown"}</p>
                          {instagramDetails.account?.name && (
                            <p className="truncate text-sm text-slate-600">{instagramDetails.account.name}</p>
                          )}
                        </div>
                      </div>
                      {instagramDetails.account?.biography && (
                        <p className="mt-3 text-sm leading-relaxed text-slate-600">{instagramDetails.account.biography}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                        <p className="muted-text text-xs">Followers</p>
                        <p className="mt-1 text-xl font-bold font-display">
                          {formatNumber(instagramDetails.account?.followersCount)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                        <p className="muted-text text-xs">Following</p>
                        <p className="mt-1 text-xl font-bold font-display">
                          {formatNumber(instagramDetails.account?.followsCount)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                        <p className="muted-text text-xs">Posts</p>
                        <p className="mt-1 text-xl font-bold font-display">
                          {formatNumber(instagramDetails.account?.mediaCount)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                        <p className="muted-text text-xs">Profile Views</p>
                        <p className="mt-1 text-xl font-bold font-display">
                          {formatNumber(instagramDetails.accountInsights?.profile_views || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                      <p className="muted-text text-xs">Total Likes</p>
                      <p className="mt-1 text-lg font-bold font-display">{formatNumber(instagramDetails.totals?.likes || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                      <p className="muted-text text-xs">Total Comments</p>
                      <p className="mt-1 text-lg font-bold font-display">{formatNumber(instagramDetails.totals?.comments || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                      <p className="muted-text text-xs">Total Views</p>
                      <p className="mt-1 text-lg font-bold font-display">{formatNumber(instagramDetails.totals?.views || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                      <p className="muted-text text-xs">Total Reach</p>
                      <p className="mt-1 text-lg font-bold font-display">{formatNumber(instagramDetails.totals?.reach || 0)}</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 md:hidden">
                    {(instagramDetails.recentMedia || []).map((item) => (
                      <article key={item.id} className="rounded-xl border border-slate-200 bg-white/85 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="status-pill bg-slate-100 text-slate-700">{item.mediaType}</span>
                          <p className="text-[11px] text-slate-500">{formatDate(item.timestamp)}</p>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg bg-slate-100/80 px-2 py-1.5">
                            <p className="muted-text">Likes</p>
                            <p className="font-semibold">{formatNumber(item.likeCount)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-100/80 px-2 py-1.5">
                            <p className="muted-text">Comments</p>
                            <p className="font-semibold">{formatNumber(item.commentCount)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-100/80 px-2 py-1.5">
                            <p className="muted-text">Views</p>
                            <p className="font-semibold">{formatNumber(item.views)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-100/80 px-2 py-1.5">
                            <p className="muted-text">Reach</p>
                            <p className="font-semibold">{formatNumber(item.reach)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-100/80 px-2 py-1.5">
                            <p className="muted-text">Impressions</p>
                            <p className="font-semibold">{formatNumber(item.impressions)}</p>
                          </div>
                        </div>
                      </article>
                    ))}

                    {!instagramDetails.recentMedia?.length && (
                      <p className="rounded-xl border border-slate-200 bg-white/85 px-3 py-4 text-center text-sm text-slate-500">
                        No media analytics available.
                      </p>
                    )}
                  </div>

                  <div className="mt-5 hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="text-slate-600">
                        <tr className="border-b border-slate-200">
                          <th className="py-2">Type</th>
                          <th className="py-2">Date</th>
                          <th className="py-2">Likes</th>
                          <th className="py-2">Comments</th>
                          <th className="py-2">Views</th>
                          <th className="py-2">Reach</th>
                          <th className="py-2">Impressions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(instagramDetails.recentMedia || []).map((item) => (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="py-2">{item.mediaType}</td>
                            <td className="py-2">{formatDate(item.timestamp)}</td>
                            <td className="py-2">{formatNumber(item.likeCount)}</td>
                            <td className="py-2">{formatNumber(item.commentCount)}</td>
                            <td className="py-2">{formatNumber(item.views)}</td>
                            <td className="py-2">{formatNumber(item.reach)}</td>
                            <td className="py-2">{formatNumber(item.impressions)}</td>
                          </tr>
                        ))}
                        {!instagramDetails.recentMedia?.length && (
                          <tr>
                            <td colSpan={7} className="py-5 text-center text-slate-500">
                              No media analytics available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === "insights" && instagramStatus && !instagramStatus.valid && (
            <section className="glass-panel rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 flex-shrink-0 text-red-400" size={18} />
                <div>
                  <p className="text-sm font-semibold text-red-300">Instagram Token Invalid</p>
                  <p className="mt-1 text-xs text-red-200">{instagramStatus.error}</p>
                  <p className="mt-2 text-xs text-red-200">Update your Instagram access token in the .env file and restart the server.</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === "schedule" && (
            <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
              <motion.form
                onSubmit={submitSchedule}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="glass-panel rounded-2xl p-5 md:p-6"
              >
                <h3 className="text-xl font-bold font-display">Schedule New Upload</h3>
                <p className="mt-1 text-sm text-muted">
                  Upload MP4 with audio for reels, or use a public media URL.
                </p>

                <label className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={autoGenerateText}
                    onChange={(e) => setAutoGenerateText(e.target.checked)}
                  />
                  Auto-generate caption + keywords + hashtags on upload
                </label>

                {/* Input mode toggle */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("upload");
                      setExtractError("");
                      setMediaUrl("");
                    }}
                    className={`tab-btn flex items-center gap-1.5 ${inputMode === "upload" ? "active" : "inactive"}`}
                  >
                    <Upload size={13} /> Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("direct");
                      setExtractError("");
                      setMediaFile(null);
                      setMediaPreview("");
                    }}
                    className={`tab-btn flex items-center gap-1.5 ${inputMode === "direct" ? "active" : "inactive"}`}
                  >
                    <Link2 size={13} /> Direct URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("instagram");
                      setExtractError("");
                      setMediaFile(null);
                      setMediaPreview("");
                    }}
                    className={`tab-btn flex items-center gap-1.5 ${inputMode === "instagram" ? "active" : "inactive"}`}
                  >
                    <Download size={13} /> Instagram URL
                  </button>
                </div>

                {inputMode === "upload" && (
                  <label className="mt-4 block text-sm text-muted">
                    Upload media file (MP4/MOV/JPG/PNG/WEBP)
                    <input
                      type="file"
                      accept={postType === "reel" ? "video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp,video/mp4,video/quicktime"}
                      onChange={handleFileChange}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-950"
                    />
                    <p className="mt-2 text-xs text-muted">
                      For reels, upload MP4 with audio. File is uploaded first, then scheduled.
                    </p>
                    <p className="mt-1 text-xs text-amber-300">
                      Tip: for real Instagram publishing, media URL must be publicly reachable (not localhost).
                    </p>
                  </label>
                )}

                {/* Instagram URL extractor */}
                {inputMode === "instagram" && (
                  <div className="mt-4">
                    <label className="block text-sm text-muted">
                      Instagram post / reel URL
                      <div className="mt-2 flex gap-2">
                        <input
                          type="url"
                          placeholder="https://www.instagram.com/reel/ABC123/"
                          value={instagramUrl}
                          onChange={(e) => { setInstagramUrl(e.target.value); setExtractError(""); }}
                          className="field-base flex-1 px-3 py-2 text-sm text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={handleExtract}
                          disabled={extracting || !instagramUrl.trim()}
                          className="pro-btn whitespace-nowrap px-4 py-2 text-sm disabled:opacity-60"
                        >
                          {extracting ? "Extracting..." : "Extract Media"}
                        </button>
                        <button
                          type="button"
                          onClick={handleExtractAndAutoPost}
                          disabled={autoPostingFromLink || !instagramUrl.trim()}
                          className="ghost-btn whitespace-nowrap px-4 py-2 text-sm disabled:opacity-60"
                        >
                          {autoPostingFromLink ? "Auto Posting..." : "Auto Post Now"}
                        </button>
                      </div>
                    </label>
                    {extractError && <p className="mt-2 text-sm text-red-400">{extractError}</p>}
                    {mediaUrl && !extractError && (
                      <p className="mt-2 text-xs text-emerald-400">Media extracted — check preview on the right, then set a schedule time and caption below.</p>
                    )}
                  </div>
                )}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-muted">
                    Post type
                    <select
                      value={postType}
                      onChange={(e) => setPostType(e.target.value)}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="reel">Reel</option>
                      <option value="post">Image Post</option>
                    </select>
                  </label>

                  <label className="text-sm text-muted">
                    Schedule time
                    <input
                      required
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                    />
                  </label>
                </div>

                {inputMode !== "upload" && (
                  <label className="mt-4 block text-sm text-muted">
                    {inputMode === "direct" ? "Media URL" : "Extracted Media URL (read-only)"}
                    <input
                      required
                      type="url"
                      placeholder={postType === "reel" ? "https://.../video.mp4" : "https://.../image.jpg"}
                      value={mediaUrl}
                      readOnly={inputMode === "instagram"}
                      onChange={(e) => inputMode === "direct" && setMediaUrl(e.target.value)}
                      className={`field-base mt-2 w-full px-3 py-2 text-sm text-slate-800 ${inputMode === "instagram" ? "cursor-default opacity-60" : ""}`}
                    />
                  </label>
                )}

                <label className="mt-4 block text-sm text-muted">
                  Caption
                  <textarea
                    rows={5}
                    placeholder="Write your Instagram caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                  />
                </label>

                {!!generatedKeywords.length && (
                  <div className="mt-3">
                    <p className="text-xs text-muted">Generated keywords</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {generatedKeywords.map((keyword) => (
                        <span key={keyword} className="status-pill bg-slate-200/80 text-slate-700">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!!generatedHashtags.length && (
                  <div className="mt-3">
                    <p className="text-xs text-muted">Generated hashtags</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {generatedHashtags.map((tag) => (
                        <span key={tag} className="status-pill bg-cyan-500/20 text-cyan-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {message && <p className="mt-4 text-sm text-accent">{message}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="pro-btn mt-6 px-5 py-3 text-sm disabled:opacity-70"
                >
                  {submitting ? "Scheduling..." : "Schedule Post"}
                </button>
              </motion.form>

              <motion.aside
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45 }}
                className="glass-panel rounded-2xl p-5"
              >
                <h4 className="text-base font-bold font-display">Media Preview</h4>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white/75 p-2">
                  {mediaPreview || mediaUrl ? (
                    <>
                      {postType === "reel" ? (
                        <video controls src={mediaPreview || mediaUrl} className="h-64 w-full rounded-lg object-cover" />
                      ) : (
                        <img src={mediaPreview || mediaUrl} alt="Selected media" className="h-64 w-full rounded-lg object-cover" />
                      )}
                      <p className="mt-2 truncate text-xs text-muted">{mediaFile?.name || mediaUrl}</p>
                    </>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-muted">
                      No media URL entered
                    </div>
                  )}
                </div>
              </motion.aside>
            </section>
          )}

          {activeTab === "animeAutomation" && (
            <section className="glass-panel animate-floatIn rounded-2xl p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold font-display">Anime Auto Mode</h3>
                  <p className="mt-1 text-sm text-muted">
                    Pull high-quality anime reels or image posts from Reddit and auto-schedule at your fixed daily times.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runAutoAnimeNow}
                  disabled={autoAnimeRunning || autoAnimeLoading}
                  className="ghost-btn px-3 py-2 text-xs disabled:opacity-60"
                >
                  {autoAnimeRunning ? "Running..." : "Run Now"}
                </button>
              </div>

              {autoAnimeLoading && (
                <p className="mt-4 text-sm text-muted">Loading anime automation config...</p>
              )}

              {autoAnimeConfig && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-muted">
                    <span className="flex items-center gap-2 text-slate-100">
                      <input
                        type="checkbox"
                        checked={Boolean(autoAnimeConfig.enabled)}
                        onChange={(e) => updateAutoAnimeField("enabled", e.target.checked)}
                      />
                      Enable auto anime scheduling
                    </span>
                  </label>

                  <label className="text-sm text-muted">
                    Timezone
                    <input
                      type="text"
                      value={autoAnimeConfig.timezone || "Asia/Kolkata"}
                      onChange={(e) => updateAutoAnimeField("timezone", e.target.value)}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                      placeholder="Asia/Kolkata"
                    />
                  </label>

                  <label className="text-sm text-muted">
                    Auto content type
                    <select
                      value={autoAnimeConfig.contentType || "reel"}
                      onChange={(e) => updateAutoAnimeField("contentType", e.target.value)}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="reel">Reels only</option>
                      <option value="post">Image posts only</option>
                      <option value="both">Both reels + image posts</option>
                    </select>
                  </label>

                  <label className="text-sm text-muted">
                    <span className="flex items-center gap-2 text-slate-100">
                      <input
                        type="checkbox"
                        checked={autoAnimeConfig.randomMode !== false}
                        onChange={(e) => updateAutoAnimeField("randomMode", e.target.checked)}
                      />
                      Random anime mode (no strict match filters)
                    </span>
                  </label>

                  <label className="text-sm text-muted md:col-span-2">
                    Subreddits (comma-separated)
                    <input
                      type="text"
                      value={(autoAnimeConfig.subreddits || []).join(", ")}
                      onChange={(e) =>
                        updateAutoAnimeField(
                          "subreddits",
                          e.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      }
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                      placeholder="Animeedits, AnimeMusicVideos, anime_edits, anime"
                    />
                  </label>

                  <label className="text-sm text-muted md:col-span-2">
                    Source keyword filter (optional, comma-separated)
                    <input
                      type="text"
                      value={(autoAnimeConfig.keywords || []).join(", ")}
                      onChange={(e) =>
                        updateAutoAnimeField(
                          "keywords",
                          e.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      }
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                      placeholder="leave empty for broad match"
                    />
                  </label>

                  <label className="text-sm text-muted">
                    Minimum Reddit score
                    <input
                      type="number"
                      min={0}
                      value={autoAnimeConfig.minScore ?? 20}
                      onChange={(e) => updateAutoAnimeField("minScore", Number(e.target.value))}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                    />
                  </label>

                  <label className="text-sm text-muted">
                    Minimum width (px)
                    <input
                      type="number"
                      min={240}
                      value={autoAnimeConfig.minWidth ?? 720}
                      onChange={(e) => updateAutoAnimeField("minWidth", Number(e.target.value))}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                    />
                  </label>

                  <label className="text-sm text-muted">
                    Max age (hours)
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={autoAnimeConfig.maxAgeHours ?? 72}
                      onChange={(e) => updateAutoAnimeField("maxAgeHours", Number(e.target.value))}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                    />
                  </label>

                  <div className="md:col-span-2">
                    <p className="text-sm text-muted">Manual fixed time slots (HH:mm)</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={newTimeSlot}
                        onChange={(e) => setNewTimeSlot(e.target.value)}
                        className="field-base px-3 py-2 text-sm text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={addTimeSlot}
                        className="ghost-btn inline-flex items-center gap-1 px-3 py-2 text-xs"
                      >
                        <Plus size={13} />
                        Add Time
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(autoAnimeConfig.timeSlots || []).map((slot) => (
                        <span key={slot} className="status-pill inline-flex items-center gap-1 bg-cyan-100 text-cyan-900">
                          {slot}
                          <button type="button" onClick={() => removeTimeSlot(slot)} className="opacity-80 hover:opacity-100">
                            <Trash2 size={12} />
                          </button>
                        </span>
                      ))}
                      {!autoAnimeConfig.timeSlots?.length && (
                        <p className="text-xs text-amber-300">Add at least one time slot for automatic runs.</p>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Caption Engine</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Caption combines template + rotating hashtags + rotating keywords + dynamic keywords from reel title.
                    </p>
                  </div>

                  <label className="text-sm text-muted md:col-span-2">
                    Caption template
                    <textarea
                      rows={4}
                      value={autoAnimeConfig.captionTemplate || ""}
                      onChange={(e) => updateAutoAnimeField("captionTemplate", e.target.value)}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                      placeholder="{{anime}} edit drop\n{{title}}\n\n#anime #edit #reels"
                    />
                    <p className="mt-1 text-xs text-muted">Variables: {"{{anime}}"}, {"{{title}}"}, {"{{subreddit}}"}, {"{{sourceUrl}}"}</p>
                  </label>

                  <label className="text-sm text-muted md:col-span-2">
                    Hashtag sets rotation (one set per line)
                    <textarea
                      rows={4}
                      value={(autoAnimeConfig.hashtagSets || []).join("\n")}
                      onChange={(e) => updateAutoAnimeField("hashtagSets", e.target.value.split("\n"))}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                      placeholder="#AnimeEdit #AnimeReels #AMV"
                    />
                    <p className="mt-1 text-xs text-muted">Set 1 is used first, then it rotates to the next set automatically on each queued post.</p>
                  </label>

                  <label className="text-sm text-muted md:col-span-2">
                    Keyword sets rotation (one set per line)
                    <textarea
                      rows={4}
                      value={(autoAnimeConfig.keywordSets || []).join("\n")}
                      onChange={(e) => updateAutoAnimeField("keywordSets", e.target.value.split("\n"))}
                      className="field-base mt-2 w-full px-3 py-2 text-sm text-slate-800"
                      placeholder="anime edit, trending anime, amv style"
                    />
                    <p className="mt-1 text-xs text-muted">One keyword set is added into caption each run and rotates automatically, just like hashtag sets.</p>
                  </label>

                  <div className="md:col-span-2 rounded-xl border border-cyan-200/60 bg-cyan-50/50 p-3">
                    <p className="text-sm font-semibold text-cyan-800">Troubleshooting no-match issue</p>
                    <ul className="mt-1 list-disc pl-5 text-xs text-cyan-700">
                      <li>Set content type to both for higher success rate.</li>
                      <li>Lower min score to 5-10 and min width to 480 if source is sparse.</li>
                      <li>Keep active subreddits like Animeedits and AnimeMusicVideos.</li>
                    </ul>
                  </div>
                </div>
              )}

              {autoAnimeMessage && <p className="mt-4 text-sm text-accent">{autoAnimeMessage}</p>}

              <button
                type="button"
                onClick={saveAutoAnimeConfig}
                disabled={autoAnimeSaving || autoAnimeLoading || !autoAnimeConfig}
                className="pro-btn mt-6 px-5 py-3 text-sm disabled:opacity-70"
              >
                {autoAnimeSaving ? "Saving..." : "Save Automation Settings"}
              </button>
            </section>
          )}

          {activeTab === "pending" && (
            <section className="glass-panel animate-floatIn rounded-2xl p-5">
              <h3 className="text-xl font-bold font-display">Scheduled Queue</h3>

              <div className="mt-4 space-y-3 md:hidden">
                {pendingPosts.map((post) => (
                  <article key={post._id} className="rounded-xl border border-slate-200 bg-white/85 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="status-pill inline-flex items-center gap-1 bg-slate-100 text-slate-700">
                        {post.postType === "reel" ? <Film size={13} /> : <Image size={13} />}
                        {post.postType}
                      </span>
                      <span
                        className={`status-pill ${
                          post.status === "processing"
                            ? "bg-cyan-100 text-cyan-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm text-slate-700">{post.caption || "No caption"}</p>

                    <div className="mt-3 rounded-lg bg-slate-100/80 px-2.5 py-2 text-xs">
                      <p className="muted-text">Scheduled</p>
                      <p className="mt-0.5 font-semibold text-slate-700">{formatDate(post.scheduledTime)}</p>
                    </div>
                  </article>
                ))}

                {!pendingPosts.length && (
                  <p className="rounded-xl border border-slate-200 bg-white/85 px-3 py-5 text-center text-sm text-muted">
                    No pending posts.
                  </p>
                )}
              </div>

              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="text-muted">
                    <tr className="border-b border-white/10">
                      <th className="py-3">Type</th>
                      <th className="py-3">Caption</th>
                      <th className="py-3">Scheduled</th>
                      <th className="py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPosts.map((post) => (
                      <tr key={post._id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                        <td className="py-3 pr-4">
                          <span className="status-pill inline-flex items-center gap-1">
                            {post.postType === "reel" ? <Film size={13} /> : <Image size={13} />}
                            {post.postType}
                          </span>
                        </td>
                        <td className="max-w-sm truncate py-3 pr-4">{post.caption || "-"}</td>
                        <td className="py-3 pr-4">{formatDate(post.scheduledTime)}</td>
                        <td className="py-3">
                          <span
                            className={`status-pill ${
                              post.status === "processing"
                                ? "bg-cyan-100 text-cyan-900"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {post.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!pendingPosts.length && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-muted">
                          No pending posts.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "history" && (
            <section className="glass-panel animate-floatIn rounded-2xl p-5">
              <h3 className="text-xl font-bold font-display">Posting History</h3>

              <div className="mt-4 space-y-3 md:hidden">
                {history.map((post) => (
                  <article key={post._id} className="rounded-xl border border-slate-200 bg-white/85 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="status-pill inline-flex items-center gap-1 bg-slate-100 text-slate-700">
                        {post.postType === "reel" ? <Film size={13} /> : <Image size={13} />}
                        {post.postType}
                      </span>
                      <span
                        className={`status-pill ${
                          post.status === "posted"
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-red-100 text-red-900"
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg bg-slate-100/80 px-2.5 py-2 text-xs">
                      <p className="muted-text">Posted</p>
                      <p className="mt-0.5 font-semibold text-slate-700">{formatDate(post.updatedAt)}</p>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                      <span>Attempts: {post.attempts}</span>
                    </div>

                    {post.errorLog && (
                      <p className="mt-2 line-clamp-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700">{post.errorLog}</p>
                    )}
                  </article>
                ))}

                {!history.length && (
                  <p className="rounded-xl border border-slate-200 bg-white/85 px-3 py-5 text-center text-sm text-muted">
                    No history yet.
                  </p>
                )}
              </div>

              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="text-muted">
                    <tr className="border-b border-white/10">
                      <th className="py-3">Type</th>
                      <th className="py-3">Time</th>
                      <th className="py-3">Attempts</th>
                      <th className="py-3">Status</th>
                      <th className="py-3">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((post) => (
                      <tr key={post._id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                        <td className="py-3 pr-4">{post.postType}</td>
                        <td className="py-3 pr-4">{formatDate(post.updatedAt)}</td>
                        <td className="py-3 pr-4">{post.attempts}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`status-pill ${
                              post.status === "posted"
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-red-100 text-red-900"
                            }`}
                          >
                            {post.status}
                          </span>
                        </td>
                        <td className="max-w-xs truncate py-3 text-muted">{post.errorLog || "-"}</td>
                      </tr>
                    ))}
                    {!history.length && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted">
                          No history yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto fade-rise rounded-xl border px-3 py-2 text-sm shadow-xl ${
              toast.tone === "success"
                ? "border-emerald-300/60 bg-emerald-500/90 text-white"
                : toast.tone === "danger"
                  ? "border-red-300/60 bg-red-500/90 text-white"
                  : toast.tone === "warn"
                    ? "border-amber-300/60 bg-amber-500/90 text-slate-950"
                    : "border-cyan-300/60 bg-cyan-500/90 text-slate-950"
            }`}
          >
            <p className="font-semibold">{toast.title}</p>
            {toast.description && <p className="mt-0.5 text-xs opacity-90">{toast.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
