import React, { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import CommandCenter from "./pages/CommandCenter";
import Scheduler from "./pages/Scheduler";
import Queue from "./pages/Queue";
import Automation from "./pages/Automation";
import MusicStudio from "./pages/MusicStudio";
import Insights from "./pages/Insights";
import Monitor from "./pages/Monitor";


export default function DashboardLayout() {
  const [tab, setTab] = useState("controlCenter");

  const renderPage = () => {
    switch (tab) {
      case "controlCenter": return <CommandCenter />;
      case "schedule": return <Scheduler />;
      case "queue": return <Queue />;
      case "automation": return <Automation />;
      case "musicStudio": return <MusicStudio />;
      case "insights": return <Insights />;
      case "liveMonitor": return <Monitor />;
      case "animeAutomation": return <Automation />;
      default: return <CommandCenter />;
    }
  };

  return (
    <div className="app">
      <div style={{position: 'fixed', top: 0, left: 0, right: 0, background: '#ff0', color: '#000', zIndex: 9999, textAlign: 'center', fontWeight: 'bold', padding: '8px'}}>DEBUG: DashboardLayout is rendering</div>
      <Sidebar activeTab={tab} onTabChange={setTab} />
      <div className="main">
        <TopBar />
        {renderPage()}
      </div>
    </div>
  );
}
