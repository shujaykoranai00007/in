import { motion } from "framer-motion";
import { Radar as InsightIcon, RefreshCcw, Activity } from "lucide-react";
import { ProCard, ProHeader, formatShortNumber } from "../components/ui/ProComponents";

export default function InsightsPage({ instagramDetails, insightsError, onRefresh }) {
  return (
    <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">

      {/* Error Banner */}
      {insightsError && (
        <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between gap-4">
          <p className="text-[13px] font-semibold text-rose-700">{insightsError}</p>
          <button onClick={onRefresh} className="ghost-elite-btn px-6 py-3 text-[11px]">Retry</button>
        </div>
      )}

      {instagramDetails?.account ? (
        <>
          {/* Profile Card */}
          <ProCard className="flex flex-col md:flex-row items-center gap-10 p-10">
            <img
              src={instagramDetails.account.profilePictureUrl || ""}
              onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${instagramDetails.account.username}&background=0891b2&color=fff&size=160`; }}
              className="w-28 h-28 rounded-full border-4 border-white shadow-xl object-cover flex-shrink-0"
              alt="Profile"
            />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Connected Instagram Account</p>
                <h2 className="text-2xl font-black text-slate-950 tracking-tight mt-1">@{instagramDetails.account.username}</h2>
                {instagramDetails.account.biography && (
                  <p className="text-[13px] text-slate-500 mt-2 leading-snug max-w-lg">{instagramDetails.account.biography}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-8 pt-2">
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Followers</p>
                  <p className="text-2xl font-black text-slate-950">{formatShortNumber(instagramDetails.account.followersCount)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Following</p>
                  <p className="text-2xl font-black text-slate-950">{formatShortNumber(instagramDetails.account.followsCount)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Posts</p>
                  <p className="text-2xl font-black text-slate-950">{formatShortNumber(instagramDetails.account.mediaCount)}</p>
                </div>
              </div>
            </div>
            <button onClick={onRefresh} className="ghost-elite-btn px-6 py-3 text-[11px] self-start flex items-center gap-2">
              <RefreshCcw size={14} /> Refresh
            </button>
          </ProCard>

          {/* Stats Row */}
          {instagramDetails.totals && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: "Total Likes", value: formatShortNumber(instagramDetails.totals.likes), color: "bg-rose-50 border-rose-100" },
                { label: "Total Comments", value: formatShortNumber(instagramDetails.totals.comments), color: "bg-cyan-50 border-cyan-100" },
                { label: "Total Views", value: formatShortNumber(instagramDetails.totals.views), color: "bg-purple-50 border-purple-100" },
                { label: "Total Saves", value: formatShortNumber(instagramDetails.totals.saves), color: "bg-emerald-50 border-emerald-100" },
              ].map(stat => (
                <div key={stat.label} className={`p-7 rounded-2xl border ${stat.color}`}>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                  <p className="text-3xl font-black text-slate-950">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recent Posts Grid */}
          <div>
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5">Recent Posts</h3>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(instagramDetails.recentMedia || []).map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden group hover:shadow-lg transition-all">
                  <div className="aspect-square bg-slate-100 overflow-hidden">
                    {item.mediaType === "VIDEO"
                      ? <video src={item.mediaUrl} className="w-full h-full object-cover" />
                      : <img src={item.mediaUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Post" />
                    }
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.mediaType}</span>
                      <div className="flex items-center gap-1.5 text-[13px] font-black text-slate-700">
                        <Activity size={12} className="text-rose-500" />
                        {formatShortNumber(item.likeCount)}
                      </div>
                    </div>
                    {item.caption && <p className="text-[12px] text-slate-400 line-clamp-2 leading-snug">{item.caption}</p>}
                    <a
                      href={item.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full text-center py-2.5 bg-slate-50 hover:bg-slate-900 hover:text-white text-[11px] font-black text-slate-600 rounded-xl transition-all uppercase tracking-widest"
                    >
                      View on Instagram
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : !insightsError ? (
        <ProCard className="py-32 text-center">
          <RefreshCcw size={40} className="mx-auto text-slate-200 mb-5 animate-spin-slow" />
          <p className="text-[14px] font-semibold text-slate-400">Loading your Instagram profile...</p>
          <button onClick={onRefresh} className="mt-5 ghost-elite-btn px-8 py-3 text-[11px]">Retry Now</button>
        </ProCard>
      ) : null}
    </motion.div>
  );
}
