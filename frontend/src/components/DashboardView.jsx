import { useEffect, useMemo, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Clapperboard,
  Link2,
  Trash2,
  Upload,
  Zap,
  LayoutDashboard,
  History as HistoryIcon,
  Gamepad2,
  RefreshCcw,
  CheckCircle,
  Cpu,
  TrendingUp,
  Globe,
  Filter,
  Film,
  Image as ImageIcon,
  Layers,
  Radar,
  ChevronRight
} from "lucide-react";
import api from "../services/api";
import Sidebar from "./Sidebar";

// --- ANIMATION CONFIG ---

const fSpring = { type: "spring", stiffness: 120, damping: 25 };
const containerStagger = { animate: { transition: { staggerChildren: 0.1 } } };

// --- HELPERS ---

function formatDate(dateString) { if (!dateString) return "Pending"; return new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatShortNumber(num) { if (num === undefined || num === null) return "0"; if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"; if (num >= 1000) return (num / 1000).toFixed(1) + "K"; return num.toString(); }
function getProgressForPost(post) { const s = String(post?.status || "").toLowerCase(); return s === "posted" || s === "failed" ? 100 : (s === "processing" ? 75 : 0); }

// --- PROFESSIONAL ELITE COMPONENTS ---

const ProHeader = ({ icon: Icon, title, highlight, subtitle }) => (
  <div className="flex items-center gap-6 mb-10">
    <div className="w-16 h-16 rounded-[24px] bg-slate-50 border border-slate-100 flex items-center justify-center text-cyan-600 shadow-sm"><Icon size={28} /></div>
    <div>
      <p className="pro-subheader">InstaFlow Pro • Professional Suite</p>
      <h3 className="pro-header italic">{title} <span className="opacity-30">{highlight}</span></h3>
      {subtitle && <p className="mt-2 text-[14px] font-black text-slate-500 uppercase italic tracking-wider">{subtitle}</p>}
    </div>
  </div>
);

const ProCard = ({ children, className = "" }) => (
  <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={fSpring} className={`pro-card p-10 lg:p-14 ${className}`}>
    {children}
  </motion.div>
);
// --- STAT CARD ---
const StatCard = ({ label, value, sub, color = "bg-slate-50", dot = "bg-slate-300", icon: Icon }) => (
  <div className={`${color} rounded-2xl p-8 border border-slate-100 flex flex-col gap-3 hover:shadow-lg transition-all`}>
    <div className="flex items-center justify-between">
      <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      {Icon && <Icon size={18} className="text-slate-400" />}
    </div>
    <p className="text-4xl font-black text-slate-950 tracking-tight leading-none">{value}</p>
    <div>
      <p className="text-[13px] font-bold text-slate-700">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// --- CIRCULAR GAUGE ---
const CircularGauge = ({ percent, label, value, colorClass = "stroke-cyan-500", sub }) => {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={radius} stroke="#f1f5f9" strokeWidth="9" fill="transparent" />
          <motion.circle
            cx="56" cy="56" r={radius}
            stroke="currentColor" strokeWidth="10" fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeLinecap="round"
            className={colorClass}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-slate-900 leading-none">{value}</span>
          <span className="text-[10px] font-semibold text-slate-400 mt-1">{percent}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-black text-slate-700 uppercase tracking-wide">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

// --- LIVE MONITOR SECTION ---
const LiveMonitorSection = memo(({ activityFeedPreview, queueSnapshot, monitorPipeline, liveProgressPosts }) => {
  const totalProcessed = (queueSnapshot.pendingCount || 0) + (queueSnapshot.processingCount || 0);
  const isActive = queueSnapshot.processingCount > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

      {/* -- TOP: LIVE STATUS BANNER -- */}
      <div className={`flex items-center justify-between px-8 py-5 rounded-2xl border ${
        isActive
          ? "bg-emerald-50 border-emerald-100"
          : "bg-slate-50 border-slate-100"
      }`}>
        <div className="flex items-center gap-4">
          <span className={`w-3 h-3 rounded-full ${
            isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
          }`} />
          <span className={`text-[14px] font-black uppercase tracking-wide ${
            isActive ? "text-emerald-800" : "text-slate-500"
          }`}>
            {isActive ? "System is Active — Uploading Right Now" : "System Idle — No posts uploading"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-400">
          <Cpu size={14} />
          InstaFlow Pro • Auto Poll Every 10s
        </div>
      </div>

      {/* -- STAT CARDS ROW -- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Posts Waiting"
          value={queueSnapshot.pendingCount}
          sub="Ready to be posted"
          color="bg-amber-50"
          dot="bg-amber-400"
          icon={CalendarClock}
        />
        <StatCard
          label="Being Uploaded"
          value={queueSnapshot.processingCount}
          sub="Uploading now"
          color="bg-cyan-50"
          dot="bg-cyan-500"
          icon={Activity}
        />
        <StatCard
          label="In Queue Total"
          value={totalProcessed}
          sub="Active items"
          color="bg-purple-50"
          dot="bg-purple-400"
          icon={LayoutDashboard}
        />
        <StatCard
          label="Failed Posts"
          value={queueSnapshot.failedCount}
          sub="Need attention"
          color={queueSnapshot.failedCount > 0 ? "bg-rose-50" : "bg-slate-50"}
          dot={queueSnapshot.failedCount > 0 ? "bg-rose-500" : "bg-slate-300"}
          icon={Cpu}
        />
      </div>

      {/* -- GAUGES -- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <CircularGauge
          percent={queueSnapshot.pendingCount > 0 ? 45 : 0}
          label="Waiting"
          value={queueSnapshot.pendingCount}
          colorClass="stroke-amber-400"
          sub="Posts in queue"
        />
        <CircularGauge
          percent={queueSnapshot.processingCount > 0 ? 80 : 0}
          label="Uploading"
          value={queueSnapshot.processingCount}
          colorClass="stroke-cyan-500"
          sub="Active now"
        />
        <CircularGauge
          percent={100}
          label="Posted"
          value={124}
          colorClass="stroke-emerald-500"
          sub="All time total"
        />
        <CircularGauge
          percent={queueSnapshot.failedCount > 0 ? Math.min(queueSnapshot.failedCount * 10, 100) : 0}
          label="Failed"
          value={queueSnapshot.failedCount}
          colorClass="stroke-rose-400"
          sub="Check your token"
        />
      </div>

      {/* -- POSTING STATUS (dark strip) -- */}
      <div className="bg-slate-900 rounded-2xl p-8 lg:p-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-black text-white">Posting Status</h3>
            <p className="text-[12px] text-slate-400 mt-1">What is happening right now in the background</p>
          </div>
          <Cpu size={24} className={`${isActive ? "text-cyan-400 animate-pulse" : "text-slate-600"}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {monitorPipeline.map((step, i) => (
            <div key={step.key}>
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-[12px] font-semibold text-slate-400">{step.label}</span>
                <span className="text-[18px] font-black text-white">{step.percent}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${step.percent}%` }}
                  transition={{ duration: 1.0 + i * 0.2, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* -- RECENT ACTIVITY LOG -- */}
      <ProCard>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900">Recent Activity</h3>
            <p className="text-[12px] text-slate-400 mt-1">Latest events from your posting system</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </div>
        </div>
        <div className="space-y-3">
          {activityFeedPreview.length > 0 ? activityFeedPreview.map((event, idx) => (
            <div key={event.id || idx} className="flex items-start gap-5 p-5 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="mt-1 flex-shrink-0">
                <span className={`w-2.5 h-2.5 rounded-full block ${
                  event.tone === "success" ? "bg-emerald-500" :
                  event.tone === "error" ? "bg-rose-500" : "bg-cyan-500"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-slate-800">{event.title}</p>
                {event.description && <p className="text-[12px] text-slate-400 mt-0.5 truncate">{event.description}</p>}
              </div>
              <p className="text-[11px] text-slate-400 flex-shrink-0">{formatDate(event.createdAt)}</p>
            </div>
          )) : (
            <div className="py-16 text-center">
              <Activity size={36} className="mx-auto text-slate-200 mb-4" />
              <p className="text-[14px] font-semibold text-slate-400">No activity yet</p>
              <p className="text-[12px] text-slate-300 mt-1">Events will appear here when posts are being processed</p>
            </div>
          )}
        </div>
      </ProCard>

    </motion.div>
  );
});

// --- MAIN COMPONENT ---

export default function DashboardView({ user, onLogout, instagramStatus }) {
  const POLL_INTERVAL_MS = 10000;
  const [activeTab, setActiveTab] = useState("schedule");
  const [postType, setPostType] = useState("reel");
  const [caption, setCaption] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [pendingPosts, setPendingPosts] = useState([]);
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [activityFeed, setActivityFeed] = useState([]);
  const [inputMode, setInputMode] = useState("upload");
  const [instagramDetails, setInstagramDetails] = useState(null);
  const [insightsError, setInsightsError] = useState("");
  const [autoAnimeConfig, setAutoAnimeConfig] = useState(null);
  const [autoAnimeMessage, setAutoAnimeMessage] = useState("");
  const [newTimeSlot, setNewTimeSlot] = useState("");

  const loadPosts = async () => { try { const [{ data: pending }, { data: hist }] = await Promise.all([api.get("/posts?status=pending,processing"), api.get("/posts/history")]); setPendingPosts(pending); setHistory(hist); } catch {} };
  const loadDetails = async () => { 
    setInsightsError("");
    try { 
      const { data } = await api.get("/auth/instagram-account-details"); 
      setInstagramDetails(data); 
    } catch (e) { 
      setInsightsError(e?.response?.data?.message || "Could not load Instagram profile. Your token may be expired."); 
    } 
  };
  const loadAnime = async () => { try { const { data } = await api.get("/auto-anime"); setAutoAnimeConfig(data); } catch {} };


  useEffect(() => { loadPosts(); loadAnime(); loadDetails(); const inv = setInterval(loadPosts, POLL_INTERVAL_MS); return () => clearInterval(inv); }, [instagramStatus]);


  const queueSnapshot = useMemo(() => ({
    pendingCount: pendingPosts.filter(p => p.status === "pending").length,
    processingCount: pendingPosts.filter(p => p.status === "processing").length,
    failedCount: history.filter(p => p.status === "failed").length
  }), [pendingPosts, history]);

  const monitorPipeline = useMemo(() => {
    const isIdle = queueSnapshot.pendingCount === 0 && queueSnapshot.processingCount === 0;
    return [
      { key: "collect", label: "Finding Content", percent: isIdle ? 0 : 100 },
      { key: "prepare", label: "Preparing Post", percent: isIdle ? 0 : (queueSnapshot.processingCount > 0 ? 100 : 45) },
      { key: "upload", label: "Uploading", percent: isIdle ? 0 : (queueSnapshot.processingCount > 0 ? 80 : 0) },
      { key: "complete", label: "Done", percent: isIdle ? 0 : 0 }
    ];
  }, [queueSnapshot]);

  const handleUpdateAutoAnime = async (updates) => {
    try {
      const { data } = await api.patch("/auto-anime", updates);
      setAutoAnimeConfig(data);
      setAutoAnimeMessage("Settings saved successfully.");
      setTimeout(() => setAutoAnimeMessage(""), 4000);
    } catch { setAutoAnimeMessage("Failed to save settings."); }
  };

  const handleRunAnime = async () => {
    try {
      const res = await api.post("/auto-anime/run-now");
      setAutoAnimeMessage(res?.data?.message || "Running automation now — check Queue in 60 seconds.");
      setTimeout(() => setAutoAnimeMessage(""), 8000);
      loadPosts();
    } catch { setAutoAnimeMessage("Failed to trigger run. Is the backend online?"); }
  };

  const handleActivateDaily = async () => {
    try {
      const payload = { enabled: !autoAnimeConfig?.enabled };
      const res = await api.post("/auto-anime/activate-daily", payload);
      setAutoAnimeConfig(res?.data?.config || { ...autoAnimeConfig, ...payload });
      setAutoAnimeMessage(res?.data?.message || (payload.enabled ? "Daily automation activated." : "Daily automation deactivated."));
      setTimeout(() => setAutoAnimeMessage(""), 6000);
    } catch { setAutoAnimeMessage("Failed to toggle daily automation."); }
  };
  const handleAddTimeSlot = async () => {
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(newTimeSlot)) { setAutoAnimeMessage("Please enter a valid time in HH:MM format (e.g. 09:00)"); return; }
    const current = autoAnimeConfig?.timeSlots || [];
    if (current.includes(newTimeSlot)) { setAutoAnimeMessage("This time is already in your schedule."); return; }
    const updated = [...current, newTimeSlot].sort();
    await handleUpdateAutoAnime({ timeSlots: updated });
    setNewTimeSlot("");
  };

  const handleRemoveTimeSlot = async (slotToRemove) => {
    const current = autoAnimeConfig?.timeSlots || [];
    if (current.length <= 1) { setAutoAnimeMessage("You need at least one posting time."); return; }
    const updated = current.filter(s => s !== slotToRemove);
    await handleUpdateAutoAnime({ timeSlots: updated });
  };

  const handleFileChange = (e) => { const f = e.target.files?.[0]; if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); setPostType(f.type.startsWith("video") ? "reel" : "post"); } };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      let finalMedia = mediaUrl; if (mediaFile) { const fd = new FormData(); fd.append("media", mediaFile); const { data: up } = await api.post("/uploads/media", fd); finalMedia = up.mediaUrl; }
      await api.post("/posts", { mediaUrl: finalMedia, caption, postType, scheduledTime });
      setMessage("Post added to queue successfully!"); loadPosts(); setActiveTab("pending");
      setCaption(""); setMediaPreview(""); setMediaFile(null);
    } catch { setMessage("Failed to schedule post. Please try again."); } finally { setSubmitting(false); }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} user={user} onLogout={onLogout} />
      
      <div className="flex-1 lg:ml-[320px] p-8 lg:p-14 overflow-x-hidden">
        <main className="max-w-7xl mx-auto pl-12 lg:pl-0">
          
          <AnimatePresence mode="wait">
            {activeTab === "controlCenter" && (
              <motion.div key="control" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                <ProCard>
                   <ProHeader icon={Gamepad2} title="CONTROL" highlight="CENTER" subtitle="Check your system status and refresh the dashboard" />
                   <div className="grid gap-12 lg:grid-cols-2">
                      <div className="p-12 bg-slate-50 rounded-[40px] border border-slate-100 shadow-sm">
                         <p className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-500 mb-10">System Info</p>
                         <div className="space-y-8">
                            <div className="flex items-center justify-between"><span className="text-[15px] font-black uppercase text-slate-950">Instagram Hub Status</span><span className={`status-pro ${instagramStatus?.valid ? "bg-emerald-50 text-emerald-900 border-emerald-100" : "bg-rose-50 text-rose-900 border-rose-100"}`}>{instagramStatus?.valid ? "SECURE" : "DISCONNECTED"}</span></div>
                            <div className="flex items-center justify-between"><span className="text-[15px] font-black uppercase text-slate-950">Interface Suite</span><span className="status-pro bg-cyan-50 text-cyan-900 border-cyan-100 font-extrabold">INSTAFLOW PRO V10.1</span></div>
                         </div>
                      </div>
                      <div className="p-12 bg-slate-50 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-center gap-6">
                         <p className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-500">Actions</p>
                         <button onClick={() => window.location.reload()} className="pro-btn-elite w-full text-[13px]"><RefreshCcw size={18} /> REFRESH DASHBOARD</button>
                         <p className="text-[11px] font-black text-slate-400 uppercase italic text-center">Forces the page to reload and refresh all data</p>
                      </div>
                   </div>
                </ProCard>
              </motion.div>
            )}

            {activeTab === "liveMonitor" && (
              <LiveMonitorSection
                activityFeedPreview={activityFeed.slice(0, 15)}
                queueSnapshot={queueSnapshot}
                monitorPipeline={monitorPipeline}
                liveProgressPosts={pendingPosts.slice(0, 12)}
              />
            )}

            {activeTab === "schedule" && (
              <motion.div key="schedule" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                 <ProCard>
                   <ProHeader icon={CalendarClock} title="SCHEDULE" highlight="POST" subtitle="Manually upload media or scrape links to queue" />
                   <div className="grid gap-20 lg:grid-cols-[1.2fr_1fr]">
                     <form onSubmit={handleSubmit} className="space-y-12">
                       <div className="inline-flex bg-slate-100 p-2 rounded-[24px] border border-slate-200">
                         {[ { id: "upload", label: "UPLOAD FILE", icon: Upload }, { id: "instagram", label: "LINK SCRAPER", icon: Link2 } ].map(m => (
                           <button type="button" key={m.id} onClick={() => setInputMode(m.id)} className={`flex items-center gap-4 rounded-[18px] px-10 py-5 text-[13px] font-black tracking-tight transition-all ${inputMode === m.id ? "bg-white shadow-lg text-slate-950 scale-105" : "text-slate-500 hover:text-slate-800"}`}>
                             <m.icon size={16} /> {m.label}
                           </button>
                         ))}
                       </div>
                       {inputMode === "upload" && (
                         <div className="relative group p-20 text-center rounded-[48px] border-4 border-dashed border-slate-100 bg-slate-50 hover:bg-white hover:border-cyan-600 transition-all duration-500 cursor-pointer">
                           <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                           <Upload size={36} className="mx-auto text-slate-300 group-hover:text-cyan-600 mb-6" />
                           <p className="text-[13px] font-black uppercase text-slate-500 tracking-[0.4em] group-hover:text-slate-950">SELECT MEDIA ASSET</p>
                         </div>
                       )}
                       <div className="grid gap-10">
                         <div className="relative">
                            <textarea value={caption} onChange={e => setCaption(e.target.value)} className="w-full h-[280px] p-12 text-[17px] font-semibold border-4 border-slate-50 bg-slate-50 focus:bg-white focus:border-cyan-500 rounded-[32px] transition-all" placeholder="Paste your caption or post details here..." />
                            <p className="absolute left-10 top-[-10px] text-[10px] font-black uppercase bg-white border-2 border-cyan-100 px-4 py-1 rounded-full text-cyan-800 tracking-widest">CAPTION / DETAILS</p>
                         </div>
                         <div className="grid sm:grid-cols-2 gap-10">
                           <div className="relative"><input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="w-full pt-10 pb-6 px-10 font-black text-lg border-4 border-slate-50 rounded-[32px] bg-slate-50" required /><p className="absolute left-10 top-[-10px] text-[10px] font-black uppercase bg-white border-2 border-cyan-100 px-4 py-1 rounded-full text-cyan-800 tracking-widest">SCHEDULE TIME</p></div>
                           <button type="submit" disabled={submitting} className="pro-btn-elite w-full text-[13px] italic">{submitting ? "PROCESSING..." : "SCHEDULE POST"}</button>
                         </div>
                       </div>
                       {message && <div className="p-8 bg-emerald-50 rounded-3xl border border-emerald-100 text-[13px] font-black text-emerald-900 uppercase italic text-center animate-pulse">{message}</div>}
                     </form>
                     <aside className="aspect-[4/5] bg-slate-950 rounded-[64px] border-[16px] border-slate-950 shadow-2xl overflow-hidden relative flex flex-col justify-center items-center">
                        {mediaPreview || mediaUrl ? (
                           postType === "reel" ? <video src={mediaPreview || mediaUrl} className="w-full h-full object-cover" controls /> : <img src={mediaPreview || mediaUrl} className="w-full h-full object-cover" alt="Preview" />
                        ) : <div className="text-center opacity-20"><TrendingUp size={100} className="text-white mb-8 mx-auto" /><p className="text-[14px] font-black text-white uppercase tracking-[1em] italic">NODE STANDBY</p></div>}
                     </aside>
                   </div>
                 </ProCard>
              </motion.div>
            )}

            {activeTab === "insights" && (
              <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-10">
                 {insightsError && (
                   <div className="p-8 bg-rose-50 border border-rose-100 rounded-2xl text-[13px] font-semibold text-rose-700 flex items-center justify-between gap-4">
                     <span>{insightsError}</span>
                     <button onClick={loadDetails} className="ghost-elite-btn px-6 py-3 text-[11px]">RETRY</button>
                   </div>
                 )}
                 {instagramDetails?.account ? (
                   <>
                     <ProCard className="flex flex-col md:flex-row items-center gap-12 p-12">
                        <img src={instagramDetails.account.profilePictureUrl || ""} onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${instagramDetails.account.username}&background=0891b2&color=fff&size=160`; }} className="w-32 h-32 rounded-full border-4 border-white shadow-xl object-cover" alt="Profile" />
                        <div className="flex-1 space-y-4">
                           <div>
                             <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Connected Instagram Account</p>
                             <h4 className="text-2xl font-black text-slate-950 tracking-tight mt-1">@{instagramDetails.account.username}</h4>
                             {instagramDetails.account.biography && <p className="text-[13px] text-slate-500 mt-2 leading-snug max-w-md">{instagramDetails.account.biography}</p>}
                           </div>
                           <div className="flex flex-wrap gap-8">
                              <div><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Followers</p><p className="text-2xl font-black text-slate-950">{formatShortNumber(instagramDetails.account.followersCount)}</p></div>
                              <div><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Following</p><p className="text-2xl font-black text-slate-950">{formatShortNumber(instagramDetails.account.followsCount)}</p></div>
                              <div><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Posts</p><p className="text-2xl font-black text-slate-950">{formatShortNumber(instagramDetails.account.mediaCount)}</p></div>
                           </div>
                        </div>
                        <button onClick={loadDetails} className="ghost-elite-btn px-6 py-3 text-[11px] self-start"><RefreshCcw size={14} /> REFRESH</button>
                     </ProCard>
                     {instagramDetails.totals && (
                       <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                         {[
                           { label: "Total Likes", value: formatShortNumber(instagramDetails.totals.likes) },
                           { label: "Total Comments", value: formatShortNumber(instagramDetails.totals.comments) },
                           { label: "Total Views", value: formatShortNumber(instagramDetails.totals.views) },
                           { label: "Total Saves", value: formatShortNumber(instagramDetails.totals.saves) },
                         ].map(stat => (
                           <div key={stat.label} className="pro-card p-8">
                             <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                             <p className="text-3xl font-black text-slate-950 tracking-tight">{stat.value}</p>
                           </div>
                         ))}
                       </div>
                     )}
                     <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                       {(instagramDetails.recentMedia || []).map(item => (
                         <div key={item.id} className="pro-card group overflow-hidden">
                            <div className="aspect-square bg-slate-100 overflow-hidden">
                              {item.mediaType === "VIDEO" ? 
                                <video src={item.mediaUrl} className="w-full h-full object-cover" /> : 
                                <img src={item.mediaUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Post" />
                              }
                            </div>
                            <div className="p-8 space-y-4">
                               <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{item.mediaType}</span>
                                  <div className="flex items-center gap-2 text-[13px] font-black text-slate-700"><Activity size={14} className="text-rose-500" /> {formatShortNumber(item.likeCount)}</div>
                               </div>
                               {item.caption && <p className="text-[12px] text-slate-500 leading-snug line-clamp-2">{item.caption}</p>}
                               <a href={item.permalink} target="_blank" rel="noreferrer" className="block w-full text-center py-3 bg-slate-50 hover:bg-slate-900 hover:text-white text-[11px] font-black text-slate-600 rounded-xl transition-all uppercase tracking-widest">VIEW ON INSTAGRAM</a>
                            </div>
                         </div>
                       ))}
                     </div>
                   </>
                 ) : !insightsError ? (
                   <ProCard className="p-32 text-center">
                      <RefreshCcw size={48} className="mx-auto text-slate-200 mb-6 animate-spin-slow" />
                      <p className="text-[14px] font-semibold text-slate-400">Loading Instagram profile...</p>
                      <button onClick={loadDetails} className="mt-6 ghost-elite-btn px-8 py-3 text-[11px]">RETRY NOW</button>
                   </ProCard>
                 ) : null}
              </motion.div>
            )}

            {activeTab === "animeAutomation" && (
              <motion.div key="auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                 <ProCard>
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-12 mb-16">
                      <ProHeader icon={Clapperboard} title="DAILY" highlight="AUTO" subtitle="Finds and posts content automatically for you" />
                      <div className="flex gap-4 w-full lg:w-auto">
                        <button onClick={handleRunAnime} className="ghost-elite-btn px-10 py-5 flex-1 shadow-md uppercase text-[12px] italic font-black">RUN NOW</button>
                        <button onClick={handleActivateDaily} className={`pro-btn-elite px-14 py-5 flex-1 text-[12px] ${autoAnimeConfig?.enabled ? "from-rose-600 to-rose-700" : ""}`}>{autoAnimeConfig?.enabled ? "DEACTIVATE DAILY" : "ACTIVATE DAILY"}</button>
                      </div>
                    </div>
                    {autoAnimeMessage && <div className="mb-12 p-6 bg-cyan-50 rounded-3xl text-[12px] font-black text-cyan-900 uppercase italic text-center border-2 border-white shadow-inner">{autoAnimeMessage}</div>}
                    
                    <div className="grid gap-12 lg:grid-cols-2">
                      <div className="space-y-12 p-10 bg-slate-50/50 rounded-[40px] border border-slate-100 shadow-inner group">
                         <div className="flex items-center justify-between pb-4 border-b border-white">
                            <p className="text-[13px] font-black uppercase tracking-[0.4em] text-slate-500 italic">Content Filters</p>
                            <Filter size={20} className="text-slate-300" />
                         </div>
                         <div className="space-y-8">
                            <div className="space-y-3">
                               <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">What to post — Reels or Photos?</p>
                               <div className="flex bg-white p-2 rounded-2xl border-2 border-slate-100 shadow-sm">
                                  {[ { id: "reel", label: "REELS", icon: Film }, { id: "post", label: "PHOTOS", icon: ImageIcon }, { id: "both", label: "BOTH", icon: Layers } ].map(m => (
                                    <button key={m.id} onClick={() => handleUpdateAutoAnime({ contentType: m.id })} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black transition-all ${autoAnimeConfig?.contentType === m.id ? "bg-slate-900 text-white shadow-xl" : "text-slate-500 hover:bg-slate-50"}`}>
                                      <m.icon size={14} /> {m.label}
                                    </button>
                                  ))}
                               </div>
                            </div>
                            <div className="space-y-3">
                               <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Where to find content?</p>
                               <div className="flex bg-white p-2 rounded-2xl border-2 border-slate-100 shadow-sm">
                                  {[ { id: "reddit", label: "REDDIT API", icon: Globe }, { id: "instagram", label: "INSTA CRAWL", icon: Radar } ].map(p => (
                                    <button key={p.id} onClick={() => handleUpdateAutoAnime({ sourcePlatform: p.id })} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[11px] font-black transition-all ${autoAnimeConfig?.sourcePlatform === p.id ? "bg-slate-900 text-white shadow-xl" : "text-slate-500 hover:bg-slate-50"}`}>
                                      <p.icon size={14} /> {p.label}
                                    </button>
                                  ))}
                               </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                               <div className="relative"><input type="number" value={autoAnimeConfig?.minScore || 0} onChange={e => handleUpdateAutoAnime({ minScore: parseInt(e.target.value) })} className="w-full pt-10 pb-5 px-8 font-black text-lg border-2 border-white rounded-2xl bg-white shadow-sm" /><p className="absolute left-8 top-[-8px] text-[9px] font-black uppercase bg-white px-3 py-0.5 rounded-full text-slate-400 border border-slate-100">MIN SCORE</p></div>
                               <div className="relative"><input type="number" value={autoAnimeConfig?.maxAgeHours || 0} onChange={e => handleUpdateAutoAnime({ maxAgeHours: parseInt(e.target.value) })} className="w-full pt-10 pb-5 px-8 font-black text-lg border-2 border-white rounded-2xl bg-white shadow-sm" /><p className="absolute left-8 top-[-8px] text-[9px] font-black uppercase bg-white px-3 py-0.5 rounded-full text-slate-400 border border-slate-100">MAX AGE (HR)</p></div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-10 p-10 bg-slate-50/50 rounded-[28px] border border-slate-100">
                         <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                              <p className="text-[14px] font-black text-slate-800 uppercase">Post Times</p>
                              <p className="text-[11px] text-slate-400 mt-1">The times your content will auto-post every day</p>
                            </div>
                            <Zap size={18} className="text-amber-400" />
                         </div>
                         <div className="grid grid-cols-3 gap-4">
                           {autoAnimeConfig?.timeSlots?.map(s => (
                              <div key={s} className="bg-white border border-slate-100 rounded-2xl px-4 py-6 shadow-sm flex flex-col items-center gap-2 group hover:border-rose-200 transition-all">
                                 <Zap size={16} className="text-amber-400" />
                                 <span className="text-[18px] font-black text-slate-950 tracking-tight">{s}</span>
                                 <button onClick={() => handleRemoveTimeSlot(s)} className="text-[10px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Remove</button>
                              </div>
                           ))}
                         </div>
                         <div className="flex gap-4 pt-2">
                           <div className="flex-1 relative">
                             <input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="w-full pro-field pr-4" placeholder="09:00" />
                             <p className="absolute left-4 top-[-8px] text-[9px] font-black uppercase bg-white px-2 py-0.5 rounded-full text-slate-400 border border-slate-100">NEW TIME</p>
                           </div>
                           <button onClick={handleAddTimeSlot} className="pro-btn-elite px-8">+ ADD</button>
                         </div>
                      </div>
                    </div>
                 </ProCard>
              </motion.div>
            )}

            {activeTab === "pending" && (
              <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                 <ProCard>
                   <ProHeader icon={LayoutDashboard} title="QUEUED" highlight="POSTS" subtitle="All posts waiting to be uploaded to Instagram" />
                   <div className="grid gap-8">
                     {pendingPosts.map(post => {
                       const pct = getProgressForPost(post);
                       return (
                         <div key={post._id} className="flex flex-col md:flex-row items-center gap-10 bg-slate-50/50 rounded-[40px] p-10 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                           <div className="w-32 h-32 bg-slate-950 rounded-[32px] overflow-hidden shadow-lg border-[6px] border-white ring-2 ring-slate-100/50">{post.mediaUrl && (post.postType === "reel" ? <video src={post.mediaUrl} /> : <img src={post.mediaUrl} className="w-full h-full object-cover" />)}</div>
                           <div className="flex-1 space-y-4 text-center md:text-left">
                             <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-2">
                               <span className={`status-pro ${post.status === "processing" ? "bg-cyan-50 text-cyan-950 border-cyan-100" : "bg-white text-slate-950 border-slate-100 shadow-sm"}`}>{String(post.status).toUpperCase()}</span>
                               <p className="text-[17px] font-black uppercase text-slate-950 italic tracking-tighter">{post.postType} Post</p>
                             </div>
                             <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-widest">SCHEDULED: {formatDate(post.scheduledTime)}</p>
                           </div>
                           <div className="w-full md:w-56 h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-white"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-cyan-600 to-emerald-600 rounded-full" /></div>
                           <button className="p-6 rounded-3xl bg-rose-50 border-2 border-white text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={24} /></button>
                         </div>
                       );
                     })}
                      {!pendingPosts.length && <div className="p-32 text-center text-[14px] font-semibold text-slate-300">No posts in queue. Schedule a post to get started.</div>}
                   </div>
                 </ProCard>
              </motion.div>
            )}

            {activeTab === "history" && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                 <ProCard>
                     <ProHeader icon={HistoryIcon} title="HISTORY" highlight="LOGS" subtitle="All your previous posts and their results" />
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-[14px] font-black uppercase tracking-tight">
                        <thead className="text-slate-500 border-b border-slate-100">
                          <tr>
                             <th className="py-8 px-6">TYPE</th>
                             <th className="py-8 px-6">DATE</th>
                             <th className="py-8 px-6">STATUS</th>
                             <th className="py-8 px-6">RESULT</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-950">
                          {history.slice(0, 20).map(item => (
                            <tr key={item._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all font-black">
                              <td className="py-10 px-6 italic font-black text-slate-900">{item.postType}</td>
                              <td className="py-10 px-6 text-slate-600">{formatDate(item.updatedAt)}</td>
                              <td className="py-10 px-6"><span className={`status-pro ${item.status === "posted" ? "bg-emerald-50 text-emerald-950 border-emerald-100" : "bg-rose-50 text-rose-950 border-rose-100"}`}>{item.status}</span></td>
                               <td className="py-10 px-6 text-[13px] text-slate-500">{item.status === "posted" ? "Posted successfully on Instagram." : "Failed to post. Please check your Instagram token."}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                     {!history.length && <div className="p-32 text-center text-[14px] font-semibold text-slate-300">No posts yet. Your history will show up here after posts go live.</div>}
                 </ProCard>
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
