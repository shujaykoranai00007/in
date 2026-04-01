import { motion } from "framer-motion";
import { History as HistoryIcon } from "lucide-react";
import { ProCard, ProHeader, formatDate } from "../components/ui/ProComponents";

export default function HistoryPage({ history }) {
  return (
    <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
      <ProCard>
        <ProHeader icon={HistoryIcon} title="HISTORY" highlight="LOGS" subtitle="All your previous posts and their results" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="text-slate-400 border-b border-slate-100 text-[11px] font-black uppercase tracking-widest">
              <tr>
                <th className="py-6 px-6">Type</th>
                <th className="py-6 px-6">Date</th>
                <th className="py-6 px-6">Status</th>
                <th className="py-6 px-6">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 20).map(item => (
                <tr key={item._id} className="border-b border-slate-50 hover:bg-slate-50 transition-all">
                  <td className="py-6 px-6 font-semibold text-slate-800 capitalize">{item.postType}</td>
                  <td className="py-6 px-6 text-slate-500">{formatDate(item.updatedAt)}</td>
                  <td className="py-6 px-6">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase border tracking-wide ${
                      item.status === "posted"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                        : "bg-rose-50 text-rose-800 border-rose-100"
                    }`}>{item.status}</span>
                  </td>
                  <td className="py-6 px-6 text-[13px] text-slate-400">
                    {item.status === "posted"
                      ? "Posted successfully on Instagram."
                      : "Failed to post. Please check your Instagram token."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!history.length && (
          <div className="py-24 text-center">
            <HistoryIcon size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-[14px] font-semibold text-slate-400">No posts yet</p>
            <p className="text-[12px] text-slate-300 mt-1">Your history will show up here after posts go live.</p>
          </div>
        )}
      </ProCard>
    </motion.div>
  );
}
