import { useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Filter, Globe, Film, Layers, Zap, Loader2 } from "lucide-react";
import { Image as ImageIcon } from "lucide-react";
import { Radar } from "lucide-react";
import { ProCard, ProHeader } from "../components/ui/ProComponents";

export default function DailyAutoPage({
  autoAnimeConfig,
  autoAnimeMessage,
  runningNow,
  newTimeSlot, setNewTimeSlot,
  handleRunAnime,
  handleActivateDaily,
  handleUpdateAutoAnime,
  handleAddTimeSlot,
  handleRemoveTimeSlot,
}) {
  return (
    <motion.div key="auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <ProCard>
        {/* Header + Buttons */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-10">
          <ProHeader icon={Clapperboard} title="DAILY" highlight="AUTO" subtitle="Finds and posts content automatically for you" />
          <div className="flex gap-4 w-full lg:w-auto">
            <button
              onClick={handleRunAnime}
              disabled={runningNow}
              className={`ghost-elite-btn px-8 py-4 flex-1 text-[13px] font-black inline-flex items-center justify-center gap-3 ${runningNow ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {runningNow ? <><Loader2 size={15} className="animate-spin" /> Running...</> : "▶ Run Now"}
            </button>
            <button
              onClick={handleActivateDaily}
              className="pro-btn-elite px-10 py-4 flex-1 text-[13px] font-black"
              style={autoAnimeConfig?.enabled ? { background: "#e11d48" } : {}}
            >
              {autoAnimeConfig?.enabled ? "⏹ Stop Daily Auto" : "▶ Start Daily Auto"}
            </button>
          </div>
        </div>

        {/* Status message */}
        {autoAnimeMessage && (
          <div className="mb-8 p-5 bg-cyan-50 rounded-2xl border border-cyan-100 text-[13px] font-semibold text-cyan-800 text-center">
            {autoAnimeMessage}
          </div>
        )}

        {/* Status badge */}
        <div className="mb-8 flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${autoAnimeConfig?.enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
          <span className={`text-[14px] font-bold ${autoAnimeConfig?.enabled ? "text-emerald-700" : "text-slate-400"}`}>
            {autoAnimeConfig?.enabled ? "Daily posting is ON — running on schedule" : "Daily posting is OFF"}
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Content Filters */}
          <div className="space-y-8 p-8 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <p className="text-[14px] font-black text-slate-800">Content Filters</p>
              <Filter size={18} className="text-slate-300" />
            </div>
            <div className="space-y-6">
              {/* What to post */}
              <div className="space-y-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">What to post — Reels or Photos?</p>
                <div className="flex bg-white p-2 rounded-2xl border border-slate-100 shadow-sm gap-1">
                  {[
                    { id: "reel", label: "Reels", icon: Film },
                    { id: "post", label: "Photos", icon: ImageIcon },
                    { id: "both", label: "Both", icon: Layers },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleUpdateAutoAnime({ contentType: m.id })}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black transition-all ${autoAnimeConfig?.contentType === m.id ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"}`}
                    >
                      <m.icon size={13} /> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Where to find content */}
              <div className="space-y-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Where to find content?</p>
                <div className="flex bg-white p-2 rounded-2xl border border-slate-100 shadow-sm gap-1">
                  {[
                    { id: "reddit", label: "Reddit", icon: Globe },
                    { id: "instagram", label: "Instagram", icon: Radar },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleUpdateAutoAnime({ sourcePlatform: p.id })}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black transition-all ${autoAnimeConfig?.sourcePlatform === p.id ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"}`}
                    >
                      <p.icon size={13} /> {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Score + Max Age */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="number"
                    value={autoAnimeConfig?.minScore || 0}
                    onChange={e => handleUpdateAutoAnime({ minScore: parseInt(e.target.value) })}
                    className="w-full pt-8 pb-4 px-6 font-black text-lg border-2 border-white rounded-2xl bg-white shadow-sm"
                  />
                  <p className="absolute left-5 top-[-8px] text-[9px] font-black uppercase bg-white px-2 py-0.5 rounded-full text-slate-400 border border-slate-100">Min Score</p>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={autoAnimeConfig?.maxAgeHours || 0}
                    onChange={e => handleUpdateAutoAnime({ maxAgeHours: parseInt(e.target.value) })}
                    className="w-full pt-8 pb-4 px-6 font-black text-lg border-2 border-white rounded-2xl bg-white shadow-sm"
                  />
                  <p className="absolute left-5 top-[-8px] text-[9px] font-black uppercase bg-white px-2 py-0.5 rounded-full text-slate-400 border border-slate-100">Max Age (hr)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Post Times */}
          <div className="space-y-6 p-8 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-[14px] font-black text-slate-800">Post Times</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Times your content will auto-post every day</p>
              </div>
              <Zap size={18} className="text-amber-400" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {autoAnimeConfig?.timeSlots?.map(s => (
                <div key={s} className="bg-white border border-slate-100 rounded-2xl px-3 py-5 shadow-sm flex flex-col items-center gap-2 group hover:border-rose-200 transition-all">
                  <Zap size={14} className="text-amber-400" />
                  <span className="text-[16px] font-black text-slate-950">{s}</span>
                  <button
                    onClick={() => handleRemoveTimeSlot(s)}
                    className="text-[10px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <div className="flex-1 relative">
                <input
                  type="time"
                  value={newTimeSlot}
                  onChange={e => setNewTimeSlot(e.target.value)}
                  className="w-full pro-field"
                />
                <p className="absolute left-4 top-[-8px] text-[9px] font-black uppercase bg-white px-2 py-0.5 rounded-full text-slate-400 border border-slate-100">New Time</p>
              </div>
              <button onClick={handleAddTimeSlot} className="pro-btn-elite px-7">+ Add</button>
            </div>
          </div>
        </div>
      </ProCard>
    </motion.div>
  );
}
