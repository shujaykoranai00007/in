import { motion } from "framer-motion";
import { LayoutDashboard, Trash2 } from "lucide-react";
import { ProCard, ProHeader, formatDate, getProgressForPost } from "../components/ui/ProComponents";

export default function QueuedPostsPage({ pendingPosts, onDelete }) {
  return (
    <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
      <ProCard>
        <ProHeader icon={LayoutDashboard} title="QUEUED" highlight="POSTS" subtitle="All posts waiting to be uploaded to Instagram" />
        <div className="grid gap-6">
          {pendingPosts.map(post => {
            const pct = getProgressForPost(post);
            return (
              <div key={post._id} className="flex flex-col md:flex-row items-center gap-8 bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-lg transition-all group">
                <div className="w-24 h-24 bg-slate-950 rounded-2xl overflow-hidden shadow-lg border-4 border-white flex-shrink-0">
                  {post.mediaUrl && (
                    post.postType === "reel"
                      ? <video src={post.mediaUrl} className="w-full h-full object-cover" />
                      : <img src={post.mediaUrl} className="w-full h-full object-cover" alt="Post" />
                  )}
                </div>
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase border tracking-wide ${
                      post.status === "processing" ? "bg-cyan-50 text-cyan-800 border-cyan-100" : "bg-white text-slate-800 border-slate-100 shadow-sm"
                    }`}>{post.status}</span>
                    <p className="text-[15px] font-black text-slate-900 capitalize">{post.postType} Post</p>
                  </div>
                  <p className="text-[12px] text-slate-400">Scheduled: {formatDate(post.scheduledTime)}</p>
                  <div className="w-full max-w-xs h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                    />
                  </div>
                </div>
                <button
                  onClick={() => onDelete && onDelete(post._id)}
                  className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-600 hover:text-white transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            );
          })}
          {!pendingPosts.length && (
            <div className="py-24 text-center">
              <LayoutDashboard size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-[14px] font-semibold text-slate-400">No posts in queue</p>
              <p className="text-[12px] text-slate-300 mt-1">Schedule a post to get started.</p>
            </div>
          )}
        </div>
      </ProCard>
    </motion.div>
  );
}
