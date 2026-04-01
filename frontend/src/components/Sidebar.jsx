import { memo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Clapperboard,
  Gamepad2,
  History,
  LayoutDashboard,
  LogOut,
  Radar,
  Sparkles
} from "lucide-react";


const navItems = [
  { id: "schedule", label: "Schedule Post", icon: CalendarClock },
  { id: "pending", label: "Queued Posts", icon: LayoutDashboard },
  { id: "liveMonitor", label: "Live Monitor", icon: Activity },
  { id: "insights", label: "Insights", icon: Radar },
  { id: "animeAutomation", label: "Daily Auto", icon: Clapperboard },
  { id: "history", label: "History", icon: History },
  { id: "controlCenter", label: "Control Center", icon: Gamepad2 }
];

function Sidebar({ activeTab, onTabChange, onLogout, user }) {
  return (
    <>
      <aside className="sidebar-elite fixed left-0 top-0 bottom-0 w-[300px] hidden lg:flex flex-col p-8 z-50">
        <div className="mb-12 px-2 pt-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-cyan-600 flex items-center justify-center text-white shadow-lg shadow-cyan-900/10"><Sparkles size={18} /></div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-800 italic">Official Pro</p>
          </div>
          <h2 className="text-3xl font-black text-slate-950 uppercase italic leading-none tracking-tighter">INSTAFLOW <span className="text-slate-200">PRO</span></h2>
          
          <div className="mt-8 flex items-center gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 group hover:border-cyan-200 transition-all">
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
             <p className="text-[13px] font-black text-slate-700 truncate tracking-tight">{user?.email?.split('@')[0]}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pt-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`group relative flex w-full items-center gap-5 rounded-[18px] px-6 py-4 text-[12px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${
                  active 
                    ? "bg-slate-900 text-white shadow-lg translate-x-1" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                {active && (
                   <motion.div layoutId="nav-glow" className="absolute left-0 w-1 h-6 bg-cyan-400 rounded-r-full shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                )}
                <Icon size={20} className={active ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-700"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={onLogout}
          className="mt-8 flex w-full items-center gap-5 rounded-[18px] px-6 py-5 text-[12px] font-black uppercase tracking-[0.1em] text-rose-600 hover:bg-rose-50 transition-all"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </aside>

      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-slate-50 flex items-center justify-between p-6 lg:hidden z-50">
        <div>
          <p className="text-[14px] font-black text-slate-950 uppercase italic tracking-tighter">INSTAFLOW PRO</p>
        </div>
        <button onClick={onLogout} className="p-3 bg-rose-50 rounded-xl text-rose-600"><LogOut size={20} /></button>
      </header>

      <nav className="fixed bottom-6 left-6 right-6 bg-white/95 backdrop-blur-2xl border border-slate-100 shadow-2xl flex items-center justify-around p-4 lg:hidden z-50 rounded-3xl">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => onTabChange(item.id)} className={`p-4 rounded-2xl transition-all ${active ? "bg-slate-900 text-white shadow-lg scale-110" : "text-slate-400"}`}>
              <Icon size={22} />
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default memo(Sidebar);
