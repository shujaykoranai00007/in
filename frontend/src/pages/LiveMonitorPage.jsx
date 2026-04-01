import { memo } from "react";
import { motion } from "framer-motion";
import { Activity, CalendarClock, LayoutDashboard, Cpu } from "lucide-react";
import { ProCard } from "../components/ui/ProComponents";

// Stat Card
const StatCard = ({ label, value, sub, color = "bg-slate-50", dot = "bg-slate-300", icon: Icon }) => (
  <div className={`${color} rounded-2xl p-7 border border-slate-100 flex flex-col gap-3 hover:shadow-lg transition-all`}>
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

// Circular Gauge
const CircularGauge = ({ percent, label, value, colorClass = "stroke-cyan-500", sub }) => {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-4 p-7 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
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

const LiveMonitorPage = memo(({ activityFeedPreview, queueSnapshot, monitorPipeline }) => {
  const totalProcessed = (queueSnapshot.pendingCount || 0) + (queueSnapshot.processingCount || 0);
  const isActive = queueSnapshot.processingCount > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

      {/* Live Status Banner */}
      <div className={`flex items-center justify-between px-7 py-5 rounded-2xl border ${isActive ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"}`}>
        <div className="flex items-center gap-4">
          <span className={`w-3 h-3 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
          <span className={`text-[14px] font-black uppercase tracking-wide ${isActive ? "text-emerald-800" : "text-slate-500"}`}>
            {isActive ? "System is Active — Uploading Right Now" : "System Idle — No posts uploading"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-400">
          <Cpu size={14} /> InstaFlow Pro • Auto Poll Every 10s
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Posts Waiting" value={queueSnapshot.pendingCount} sub="Ready to be posted" color="bg-amber-50" dot="bg-amber-400" icon={CalendarClock} />
        <StatCard label="Being Uploaded" value={queueSnapshot.processingCount} sub="Uploading now" color="bg-cyan-50" dot="bg-cyan-500" icon={Activity} />
        <StatCard label="In Queue Total" value={totalProcessed} sub="Active items" color="bg-purple-50" dot="bg-purple-400" icon={LayoutDashboard} />
        <StatCard label="Failed Posts" value={queueSnapshot.failedCount} sub="Need attention" color={queueSnapshot.failedCount > 0 ? "bg-rose-50" : "bg-slate-50"} dot={queueSnapshot.failedCount > 0 ? "bg-rose-500" : "bg-slate-300"} icon={Cpu} />
      </div>

      {/* Circular Gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <CircularGauge percent={queueSnapshot.pendingCount > 0 ? 45 : 0} label="Waiting" value={queueSnapshot.pendingCount} colorClass="stroke-amber-400" sub="Posts in queue" />
        <CircularGauge percent={queueSnapshot.processingCount > 0 ? 80 : 0} label="Uploading" value={queueSnapshot.processingCount} colorClass="stroke-cyan-500" sub="Active now" />
        <CircularGauge percent={100} label="Posted" value={124} colorClass="stroke-emerald-500" sub="All time total" />
        <CircularGauge percent={queueSnapshot.failedCount > 0 ? Math.min(queueSnapshot.failedCount * 10, 100) : 0} label="Failed" value={queueSnapshot.failedCount} colorClass="stroke-rose-400" sub="Check your token" />
      </div>

      {/* Posting Status Strip */}
      <div className="bg-slate-900 rounded-2xl p-8 lg:p-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-black text-white">Posting Status</h3>
            <p className="text-[12px] text-slate-400 mt-1">What is happening right now in the background</p>
          </div>
          <Cpu size={22} className={isActive ? "text-cyan-400 animate-pulse" : "text-slate-600"} />
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

      {/* Recent Activity Feed */}
      <ProCard>
        <div className="flex items-center justify-between mb-7">
          <div>
            <h3 className="text-xl font-black text-slate-900">Recent Activity</h3>
            <p className="text-[12px] text-slate-400 mt-1">Latest events from your posting system</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </div>
        </div>
        <div className="space-y-2">
          {activityFeedPreview.length > 0 ? activityFeedPreview.map((event, idx) => (
            <div key={event.id || idx} className="flex items-start gap-5 p-5 rounded-xl hover:bg-slate-50 transition-colors">
              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 block ${event.tone === "success" ? "bg-emerald-500" : event.tone === "error" ? "bg-rose-500" : "bg-cyan-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-slate-800">{event.title}</p>
                {event.description && <p className="text-[12px] text-slate-400 mt-0.5 truncate">{event.description}</p>}
              </div>
              <p className="text-[11px] text-slate-400 flex-shrink-0">{event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : ""}</p>
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

export default LiveMonitorPage;
