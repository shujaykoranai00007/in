import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, User as UserIcon, Lock } from "lucide-react";

export default function LoginView({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin(form.email, form.password);
    } catch (err) {
      setError(err?.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12 text-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pro-card p-10 md:p-14 shadow-2xl relative overflow-hidden group"
        >
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-50 blur-[80px] rounded-full opacity-50 group-hover:scale-150 transition-all duration-1000" />
          
          <div className="text-center mb-12 relative">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl text-white">
               <Sparkles size={28} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-700 italic mb-2">InstaFlow Pro • Professional Suite</p>
            <h1 className="text-3xl font-black text-slate-950 italic uppercase tracking-tighter">SECURE <span className="text-slate-300">ACCESS</span></h1>
          </div>

          <form className="space-y-8 relative" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 ml-1">
                 <UserIcon size={12} className="text-slate-400" />
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Access Email</label>
              </div>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-[15px] font-bold focus:bg-white focus:ring-4 focus:ring-cyan-50 transition-all outline-none"
                placeholder="admin@instaflow.pro"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 ml-1">
                 <Lock size={12} className="text-slate-400" />
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Code</label>
              </div>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-[15px] font-bold focus:bg-white focus:ring-4 focus:ring-cyan-50 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-rose-50 border border-rose-100 text-rose-600 px-6 py-4 rounded-xl text-[11px] font-bold uppercase tracking-tight text-center italic">
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="pro-btn-elite w-full py-5 text-[12px] font-black italic shadow-3xl"
            >
              {loading ? "VERIFYING NODE..." : "INITIALIZE DASHBOARD"}
            </button>
          </form>

          {/* DEVELOPER ATTRIBUTION: JAY BHIMANI */}
          <div className="mt-14 pt-8 border-t border-slate-50 text-center relative">
             <div className="inline-flex items-center gap-3 px-6 py-2 bg-slate-900 border border-white shadow-xl rounded-full mb-4">
                <ShieldCheck size={14} className="text-cyan-400" />
                <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Developed by Jay Bhimani</span>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
               Master UI/UX Specialist • v10.1 Stable
             </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
