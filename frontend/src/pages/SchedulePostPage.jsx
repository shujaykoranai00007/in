import { motion } from "framer-motion";
import { CalendarClock, Upload, Link2, TrendingUp } from "lucide-react";
import { ProCard, ProHeader } from "../components/ui/ProComponents";

export default function SchedulePostPage({
  postType, setPostType,
  caption, setCaption,
  scheduledTime, setScheduledTime,
  mediaUrl, setMediaUrl,
  mediaFile, setMediaFile,
  mediaPreview, setMediaPreview,
  inputMode, setInputMode,
  submitting, message,
  handleFileChange, handleSubmit,
}) {
  return (
    <motion.div key="schedule" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
      <ProCard>
        <ProHeader icon={CalendarClock} title="SCHEDULE" highlight="POST" subtitle="Upload media or paste a link to add it to your queue" />
        <div className="grid gap-20 lg:grid-cols-[1.2fr_1fr]">
          <form onSubmit={handleSubmit} className="space-y-12">
            <div className="inline-flex bg-slate-100 p-2 rounded-[24px] border border-slate-200">
              {[
                { id: "upload", label: "Upload File", icon: Upload },
                { id: "instagram", label: "Paste Link", icon: Link2 },
              ].map(m => (
                <button
                  type="button" key={m.id}
                  onClick={() => setInputMode(m.id)}
                  className={`flex items-center gap-4 rounded-[18px] px-10 py-5 text-[13px] font-black tracking-tight transition-all ${inputMode === m.id ? "bg-white shadow-lg text-slate-950 scale-105" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <m.icon size={16} /> {m.label}
                </button>
              ))}
            </div>

            {inputMode === "upload" && (
              <div className="relative group p-20 text-center rounded-[48px] border-4 border-dashed border-slate-100 bg-slate-50 hover:bg-white hover:border-cyan-600 transition-all duration-500 cursor-pointer">
                <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload size={36} className="mx-auto text-slate-300 group-hover:text-cyan-600 mb-6" />
                <p className="text-[13px] font-black uppercase text-slate-500 tracking-[0.4em] group-hover:text-slate-950">Select a photo or video</p>
              </div>
            )}

            {inputMode === "instagram" && (
              <div className="relative">
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  className="w-full pt-10 pb-6 px-10 font-semibold text-lg border-4 border-slate-50 rounded-[32px] bg-slate-50 focus:bg-white focus:border-cyan-500 transition-all"
                  placeholder="https://www.instagram.com/reel/..."
                />
                <p className="absolute left-10 top-[-10px] text-[10px] font-black uppercase bg-white border-2 border-cyan-100 px-4 py-1 rounded-full text-cyan-800 tracking-widest">INSTAGRAM LINK</p>
              </div>
            )}

            <div className="grid gap-10">
              <div className="relative">
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  className="w-full h-[280px] p-12 text-[17px] font-semibold border-4 border-slate-50 bg-slate-50 focus:bg-white focus:border-cyan-500 rounded-[32px] transition-all"
                  placeholder="Write your caption here..."
                />
                <p className="absolute left-10 top-[-10px] text-[10px] font-black uppercase bg-white border-2 border-cyan-100 px-4 py-1 rounded-full text-cyan-800 tracking-widest">CAPTION</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-10">
                <div className="relative">
                  <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="w-full pt-10 pb-6 px-10 font-black text-lg border-4 border-slate-50 rounded-[32px] bg-slate-50 focus:bg-white focus:border-cyan-500 transition-all" required />
                  <p className="absolute left-10 top-[-10px] text-[10px] font-black uppercase bg-white border-2 border-cyan-100 px-4 py-1 rounded-full text-cyan-800 tracking-widest">SCHEDULE TIME</p>
                </div>
                <button type="submit" disabled={submitting} className="pro-btn-elite w-full text-[13px]">
                  {submitting ? "Scheduling..." : "Schedule Post"}
                </button>
              </div>
            </div>
            {message && <div className={`p-8 rounded-3xl border text-[13px] font-semibold text-center ${message.includes("success") ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-rose-50 border-rose-100 text-rose-900"}`}>{message}</div>}
          </form>

          <aside className="aspect-[4/5] bg-slate-950 rounded-[64px] border-[16px] border-slate-950 shadow-2xl overflow-hidden relative flex flex-col justify-center items-center">
            {mediaPreview || mediaUrl ? (
              postType === "reel"
                ? <video src={mediaPreview || mediaUrl} className="w-full h-full object-cover" controls />
                : <img src={mediaPreview || mediaUrl} className="w-full h-full object-cover" alt="Preview" />
            ) : (
              <div className="text-center opacity-20">
                <TrendingUp size={100} className="text-white mb-8 mx-auto" />
                <p className="text-[14px] font-black text-white uppercase tracking-[1em]">Preview</p>
              </div>
            )}
          </aside>
        </div>
      </ProCard>
    </motion.div>
  );
}
