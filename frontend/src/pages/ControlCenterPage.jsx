import { motion } from "framer-motion";
import { Gamepad2, RefreshCcw } from "lucide-react";
import { ProCard, ProHeader } from "../components/ui/ProComponents";

export default function ControlCenterPage({ instagramStatus }) {
  return (
    <motion.div key="control" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <ProCard>
        <ProHeader icon={Gamepad2} title="CONTROL" highlight="CENTER" subtitle="Check your system status and refresh the dashboard" />
        <div className="grid gap-8 lg:grid-cols-2">
          {/* System Info */}
          <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-7">System Info</p>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-slate-800">Instagram Connection</span>
                <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase border tracking-wide ${
                  instagramStatus?.valid
                    ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                    : "bg-rose-50 text-rose-800 border-rose-100"
                }`}>
                  {instagramStatus?.valid ? "✓ Connected" : "✗ Disconnected"}
                </span>
              </div>
              {instagramStatus?.username && (
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-slate-800">Account</span>
                  <span className="text-[14px] font-black text-slate-700">@{instagramStatus.username}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-slate-800">App Version</span>
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase border bg-cyan-50 text-cyan-800 border-cyan-100 tracking-wide">
                  InstaFlow Pro V10.1
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center gap-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Quick Actions</p>
            <button
              onClick={() => window.location.reload()}
              className="pro-btn-elite w-full text-[14px] flex items-center justify-center gap-3"
            >
              <RefreshCcw size={18} /> Refresh Dashboard
            </button>
            <p className="text-[12px] text-slate-400 text-center">Reloads the page and refreshes all data</p>
          </div>
        </div>

        {/* Help Tips */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            { title: "Run Now", desc: "Go to Daily Auto and press Run Now to post immediately." },
            { title: "Schedule a Post", desc: "Use the Schedule Post tab to upload and queue a post." },
            { title: "View History", desc: "The History tab shows all your past posts and their status." },
          ].map(tip => (
            <div key={tip.title} className="p-6 bg-white border border-slate-100 rounded-2xl">
              <p className="text-[13px] font-black text-slate-800 mb-1">{tip.title}</p>
              <p className="text-[12px] text-slate-400 leading-snug">{tip.desc}</p>
            </div>
          ))}
        </div>
      </ProCard>
    </motion.div>
  );
}
