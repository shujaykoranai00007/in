// Shared UI building blocks used across all pages
import { memo } from "react";
import { motion } from "framer-motion";

export const ProCard = memo(({ children, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 120, damping: 25 }}
    className={`bg-white rounded-[40px] border border-slate-50 shadow-sm p-12 transition-shadow hover:shadow-xl ${className}`}
  >
    {children}
  </motion.div>
));

export const ProHeader = ({ icon: Icon, title, highlight, subtitle }) => (
  <div className="flex items-center gap-6 mb-10">
    <div className="w-16 h-16 rounded-[24px] bg-slate-50 border border-slate-100 flex items-center justify-center text-cyan-600 shadow-sm">
      <Icon size={28} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-700">InstaFlow Pro • Professional Suite</p>
      <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tighter">
        {title} <span className="opacity-30">{highlight}</span>
      </h3>
      {subtitle && <p className="mt-1 text-[13px] font-semibold text-slate-400">{subtitle}</p>}
    </div>
  </div>
);

export function formatDate(dateString) {
  if (!dateString) return "Pending";
  return new Date(dateString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatShortNumber(num) {
  if (num === undefined || num === null) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function getProgressForPost(post) {
  const s = String(post?.status || "").toLowerCase();
  return s === "posted" || s === "failed" ? 100 : s === "processing" ? 75 : 0;
}
