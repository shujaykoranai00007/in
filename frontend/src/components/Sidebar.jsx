import { Activity, CalendarClock, Clapperboard, History, LayoutDashboard, LogOut, Radar } from "lucide-react";

const navItems = [
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "liveMonitor", label: "Live Monitor", icon: Activity },
  { id: "insights", label: "Insights", icon: Radar },
  { id: "animeAutomation", label: "Anime Auto", icon: Clapperboard },
  { id: "pending", label: "Queued Posts", icon: LayoutDashboard },
  { id: "history", label: "History", icon: History }
];

export default function Sidebar({ activeTab, onTabChange, onLogout, user }) {
  return (
    <>
      <aside className="glass-panel fade-rise hidden h-full flex-col rounded-2xl p-4 md:p-5 lg:flex">
        <div className="border-b border-white/10 pb-4">
          <p className="text-xs uppercase tracking-[0.26em]" style={{ color: "var(--accent)" }}>
            InstaFlow Pro
          </p>
          <h2 className="mt-2 text-xl font-bold font-display">Admin Console</h2>
          <p className="muted-text mt-1 truncate text-xs">{user?.email}</p>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active ? "text-white" : "muted-text ghost-btn hover:text-slate-900"
                }`}
                style={
                  active
                    ? {
                        background: "linear-gradient(140deg, rgba(53, 214, 232, 0.3), rgba(45, 141, 255, 0.3))",
                        boxShadow: "inset 0 0 0 1px rgba(53, 214, 232, 0.48), 0 10px 20px var(--accent-shadow)"
                      }
                    : undefined
                }
              >
                <Icon size={17} className={active ? "text-white" : "group-hover:text-slate-900"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={onLogout}
          className="ghost-btn muted-text flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm transition hover:border-red-400/30 hover:text-red-300"
        >
          <LogOut size={16} />
          Logout
        </button>
      </aside>

      <nav className="mobile-dock lg:hidden" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`mobile-dock-item ${active ? "active" : ""}`}
              aria-label={item.label}
              title={item.label}
            >
              <span className="mobile-dock-icon-wrap">
                <Icon size={16} />
              </span>
              <span className="mobile-dock-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
