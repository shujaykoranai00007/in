import { memo, useEffect, useRef, useState } from "react";
import {
  Activity,
  CalendarClock,
  Clapperboard,
  Gamepad2,
  History,
  LayoutDashboard,
  LogOut,
  Radar
} from "lucide-react";

const navItems = [
  { id: "controlCenter", label: "Control", icon: Gamepad2 },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "liveMonitor", label: "Live Monitor", icon: Activity },
  { id: "insights", label: "Insights", icon: Radar },
  { id: "animeAutomation", label: "Anime Auto", icon: Clapperboard },
  { id: "pending", label: "Queued Posts", icon: LayoutDashboard },
  { id: "history", label: "History", icon: History }
];

function Sidebar({ activeTab, onTabChange, onLogout, user }) {
  const [mobileTooltipId, setMobileTooltipId] = useState("");
  const longPressTimerRef = useRef(null);
  const hideTooltipTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (hideTooltipTimerRef.current) {
        window.clearTimeout(hideTooltipTimerRef.current);
      }
    };
  }, []);

  function clearTooltipTimers() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (hideTooltipTimerRef.current) {
      window.clearTimeout(hideTooltipTimerRef.current);
      hideTooltipTimerRef.current = null;
    }
  }

  function handleMobileTouchStart(itemId) {
    clearTooltipTimers();
    longPressTimerRef.current = window.setTimeout(() => {
      setMobileTooltipId(itemId);
    }, 320);
  }

  function handleMobileTouchEnd() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    hideTooltipTimerRef.current = window.setTimeout(() => {
      setMobileTooltipId("");
    }, 140);
  }

  function handleMobileTouchCancel() {
    clearTooltipTimers();
    setMobileTooltipId("");
  }

  function handleTabChange(tabId) {
    setMobileTooltipId("");
    onTabChange(tabId);
  }

  return (
    <>
      <header className="glass-panel top-float-nav fade-rise rounded-2xl px-3 py-3 lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.26em]" style={{ color: "var(--accent)" }}>
              InstaFlow Pro
            </p>
            <p className="muted-text mt-1 truncate text-xs">{user?.email}</p>
          </div>

          <button
            onClick={onLogout}
            className="ghost-btn muted-text inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition hover:border-red-400/30 hover:text-red-500"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      <header className="glass-panel top-float-nav top-orb-nav fade-rise hidden rounded-2xl px-3 py-3 md:px-4 lg:block">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.26em]" style={{ color: "var(--accent)" }}>
              InstaFlow Pro
            </p>
            <p className="muted-text mt-1 truncate text-xs">{user?.email}</p>
          </div>

          <button
            onClick={onLogout}
            className="ghost-btn muted-text inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition hover:border-red-400/30 hover:text-red-500"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>

        <nav className="orb-nav-track mt-3" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`orb-nav-item ${active ? "is-active" : ""}`}
                aria-label={item.label}
                title={item.label}
              >
                <span className="orb-core">
                  <Icon size={16} />
                </span>
                <span className="orb-label">{item.label}</span>
                <span className="nav-tooltip">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <nav className="mobile-dock lg:hidden" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabChange(item.id)}
              onTouchStart={() => handleMobileTouchStart(item.id)}
              onTouchEnd={handleMobileTouchEnd}
              onTouchCancel={handleMobileTouchCancel}
              onTouchMove={handleMobileTouchCancel}
              className={`mobile-dock-item ${active ? "active" : ""} ${
                mobileTooltipId === item.id ? "show-tooltip" : ""
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <span className="mobile-dock-icon-wrap">
                <Icon size={16} />
              </span>
              <span className="mobile-dock-label">{item.label}</span>
              <span className="nav-tooltip">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default memo(Sidebar);
