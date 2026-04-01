import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, XCircle, BellRing, Loader2, X
} from "lucide-react";
import api from "../services/api";
import Sidebar from "./Sidebar";

// Pages
import SchedulePostPage from "../pages/SchedulePostPage";
import QueuedPostsPage from "../pages/QueuedPostsPage";
import LiveMonitorPage from "../pages/LiveMonitorPage";
import InsightsPage from "../pages/InsightsPage";
import DailyAutoPage from "../pages/DailyAutoPage";
import HistoryPage from "../pages/HistoryPage";
import ControlCenterPage from "../pages/ControlCenterPage";

// ─── TOAST SYSTEM ────────────────────────────────────────────────────────────

const TOAST_ICONS = {
  success: <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />,
  error:   <XCircle size={18} className="text-rose-500 flex-shrink-0" />,
  info:    <BellRing size={18} className="text-cyan-500 flex-shrink-0" />,
  loading: <Loader2 size={18} className="text-amber-500 animate-spin flex-shrink-0" />,
};
const TOAST_COLORS = {
  success: "border-emerald-100 bg-emerald-50",
  error:   "border-rose-100 bg-rose-50",
  info:    "border-cyan-100 bg-cyan-50",
  loading: "border-amber-100 bg-amber-50",
};

const Toast = memo(({ toasts, onDismiss }) => (
  <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-[360px] pointer-events-none">
    <AnimatePresence mode="sync">
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: 80, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 80, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className={`pointer-events-auto flex items-start gap-4 p-5 rounded-2xl border shadow-xl ${TOAST_COLORS[t.type] || TOAST_COLORS.info}`}
        >
          {TOAST_ICONS[t.type]}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-slate-800">{t.title}</p>
            {t.message && <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{t.message}</p>}
          </div>
          <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-700 flex-shrink-0">
            <X size={16} />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
));

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

const POLL_MS = 10000;

export default function DashboardView({ user, onLogout, instagramStatus }) {
  const [activeTab, setActiveTab] = useState("schedule");

  // Schedule Post state
  const [postType, setPostType]           = useState("reel");
  const [caption, setCaption]             = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [mediaUrl, setMediaUrl]           = useState("");
  const [mediaFile, setMediaFile]         = useState(null);
  const [mediaPreview, setMediaPreview]   = useState("");
  const [inputMode, setInputMode]         = useState("upload");
  const [submitting, setSubmitting]       = useState(false);
  const [message, setMessage]             = useState("");

  // Posts / history
  const [pendingPosts, setPendingPosts] = useState([]);
  const [history, setHistory]           = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);

  // Insights
  const [instagramDetails, setInstagramDetails] = useState(null);
  const [insightsError, setInsightsError]       = useState("");

  // Daily Auto
  const [autoAnimeConfig, setAutoAnimeConfig] = useState(null);
  const [autoAnimeMessage, setAutoAnimeMessage] = useState("");
  const [newTimeSlot, setNewTimeSlot]         = useState("");
  const [runningNow, setRunningNow]           = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((type, title, message, duration = 6000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    if (type !== "loading") setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, []);
  const dismissToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Data loaders ─────────────────────────────────────────────────────────

  const loadPosts = async () => {
    try {
      const [{ data: pending }, { data: hist }] = await Promise.all([
        api.get("/posts?status=pending,processing"),
        api.get("/posts/history"),
      ]);
      setPendingPosts(pending);
      setHistory(hist);
      
      // Update activity feed from history log
      const logs = hist.slice(0, 15).map(h => ({
        id: h._id,
        title: h.status === 'posted' ? 'Successfully Posted' : h.status === 'failed' ? 'Post Failed' : 'Ready to Post',
        description: h.status === 'failed' ? 'Check your Instagram connection.' : `${h.postType} ready for publish.`,
        tone: h.status === 'posted' ? 'success' : h.status === 'failed' ? 'error' : 'info',
        createdAt: h.updatedAt
      }));
      setActivityFeed(logs);
    } catch {}
  };

  const loadDetails = async () => {
    setInsightsError("");
    try {
      const { data } = await api.get("/auth/instagram-account-details");
      setInstagramDetails(data);
    } catch (e) {
      setInsightsError(e?.response?.data?.message || "Could not load Instagram profile. Your token may be expired.");
    }
  };

  const loadAnime = async () => {
    try {
      const { data } = await api.get("/auto-anime");
      setAutoAnimeConfig(data);
    } catch {}
  };

  useEffect(() => {
    loadPosts();
    loadAnime();
    loadDetails();
    const inv = setInterval(loadPosts, POLL_MS);
    return () => clearInterval(inv);
  }, [instagramStatus]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const queueSnapshot = useMemo(() => ({
    pendingCount:    pendingPosts.filter(p => p.status === "pending").length,
    processingCount: pendingPosts.filter(p => p.status === "processing").length,
    failedCount:     history.filter(p => p.status === "failed").length,
  }), [pendingPosts, history]);

  const monitorPipeline = useMemo(() => {
    const idle = queueSnapshot.pendingCount === 0 && queueSnapshot.processingCount === 0;
    return [
      { key: "collect", label: "Finding Content",  percent: idle ? 0 : 100 },
      { key: "prepare", label: "Preparing Post",   percent: idle ? 0 : (queueSnapshot.processingCount > 0 ? 100 : 45) },
      { key: "upload",  label: "Uploading",        percent: idle ? 0 : (queueSnapshot.processingCount > 0 ? 80  : 0)  },
      { key: "done",    label: "Done",             percent: 0 },
    ];
  }, [queueSnapshot]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setMediaFile(f);
      setMediaPreview(URL.createObjectURL(f));
      setPostType(f.type.startsWith("video") ? "reel" : "post");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      let finalMedia = mediaUrl;
      if (mediaFile) {
        const fd = new FormData();
        fd.append("media", mediaFile);
        const { data: up } = await api.post("/uploads/media", fd);
        finalMedia = up.mediaUrl;
      }
      await api.post("/posts", { mediaUrl: finalMedia, caption, postType, scheduledTime });
      setMessage("Post added to queue successfully!");
      loadPosts();
      setActiveTab("pending");
      setCaption(""); setMediaPreview(""); setMediaFile(null);
    } catch {
      setMessage("Failed to schedule post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAutoAnime = async (updates) => {
    try {
      const { data } = await api.patch("/auto-anime", updates);
      setAutoAnimeConfig(data);
    } catch {
      addToast("error", "Save failed", "Could not save settings. Please try again.", 5000);
    }
  };

  const handleRunAnime = async () => {
    if (runningNow) return;
    setRunningNow(true);
    const loadingId = addToast("loading", "Starting automation...", "Finding content and preparing your post. This takes 60–90 seconds.", 0);
    try {
      const res = await api.post("/auto-anime/run-now");
      dismissToast(loadingId);
      addToast("success", "Automation started!", res?.data?.message || "Check Queued Posts in about 60–90 seconds.", 10000);
      loadPosts();
      setTimeout(() => { loadPosts(); setActiveTab("pending"); }, 5000);
    } catch (e) {
      dismissToast(loadingId);
      addToast("error", "Run failed", e?.response?.data?.message || "Could not reach the server. Is the backend running?", 8000);
    } finally {
      setRunningNow(false);
    }
  };

  const handleActivateDaily = async () => {
    try {
      const payload = { enabled: !autoAnimeConfig?.enabled };
      const res = await api.post("/auto-anime/activate-daily", payload);
      setAutoAnimeConfig(res?.data?.config || { ...autoAnimeConfig, ...payload });
      const isOn = payload.enabled;
      addToast(
        isOn ? "success" : "info",
        isOn ? "Daily automation is ON" : "Daily automation is OFF",
        isOn
          ? `Posts will go live at: ${(res?.data?.config?.timeSlots || []).join(", ")}`
          : "Automation paused. Toggle again to re-enable.",
        7000,
      );
      setAutoAnimeMessage(res?.data?.message || (isOn ? "Daily automation activated." : "Daily automation deactivated."));
      setTimeout(() => setAutoAnimeMessage(""), 6000);
    } catch {
      addToast("error", "Action failed", "Could not toggle daily automation. Check your backend.", 6000);
    }
  };

  const handleAddTimeSlot = async () => {
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(newTimeSlot)) { setAutoAnimeMessage("Please enter a valid time (e.g. 09:00)"); return; }
    const current = autoAnimeConfig?.timeSlots || [];
    if (current.includes(newTimeSlot)) { setAutoAnimeMessage("This time is already in your schedule."); return; }
    await handleUpdateAutoAnime({ timeSlots: [...current, newTimeSlot].sort() });
    setNewTimeSlot("");
  };

  const handleRemoveTimeSlot = async (slotToRemove) => {
    const current = autoAnimeConfig?.timeSlots || [];
    if (current.length <= 1) { setAutoAnimeMessage("You need at least one posting time."); return; }
    await handleUpdateAutoAnime({ timeSlots: current.filter(s => s !== slotToRemove) });
  };

  const handleDeletePost = async (id) => {
    try {
      await api.delete(`/posts/${id}`);
      addToast("info", "Post Deleted", "The item has been removed from your queue.", 4000);
      loadPosts();
    } catch {
      addToast("error", "Delete Failed", "Could not remove post. Please try again.", 5000);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-white text-slate-900" style={{ fontFamily: "Inter, sans-serif" }}>
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} user={user} onLogout={onLogout} />

      <div className="flex-1 lg:ml-[300px] p-6 lg:p-12 overflow-x-hidden">
        <main className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">

            {activeTab === "schedule" && (
              <SchedulePostPage key="schedule"
                postType={postType} setPostType={setPostType}
                caption={caption} setCaption={setCaption}
                scheduledTime={scheduledTime} setScheduledTime={setScheduledTime}
                mediaUrl={mediaUrl} setMediaUrl={setMediaUrl}
                mediaFile={mediaFile} setMediaFile={setMediaFile}
                mediaPreview={mediaPreview} setMediaPreview={setMediaPreview}
                inputMode={inputMode} setInputMode={setInputMode}
                submitting={submitting} message={message}
                handleFileChange={handleFileChange}
                handleSubmit={handleSubmit}
              />
            )}

            {activeTab === "pending" && (
              <QueuedPostsPage key="pending" pendingPosts={pendingPosts} onDelete={handleDeletePost} />
            )}

            {activeTab === "liveMonitor" && (
              <LiveMonitorPage key="liveMonitor"
                activityFeedPreview={activityFeed.slice(0, 15)}
                queueSnapshot={queueSnapshot}
                monitorPipeline={monitorPipeline}
              />
            )}

            {activeTab === "insights" && (
              <InsightsPage key="insights"
                instagramDetails={instagramDetails}
                insightsError={insightsError}
                onRefresh={loadDetails}
              />
            )}

            {activeTab === "animeAutomation" && (
              <DailyAutoPage key="animeAutomation"
                autoAnimeConfig={autoAnimeConfig}
                autoAnimeMessage={autoAnimeMessage}
                runningNow={runningNow}
                newTimeSlot={newTimeSlot} setNewTimeSlot={setNewTimeSlot}
                handleRunAnime={handleRunAnime}
                handleActivateDaily={handleActivateDaily}
                handleUpdateAutoAnime={handleUpdateAutoAnime}
                handleAddTimeSlot={handleAddTimeSlot}
                handleRemoveTimeSlot={handleRemoveTimeSlot}
              />
            )}

            {activeTab === "history" && (
              <HistoryPage key="history" history={history} />
            )}

            {activeTab === "controlCenter" && (
              <ControlCenterPage key="controlCenter" instagramStatus={instagramStatus} />
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
