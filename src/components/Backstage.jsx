import { useState } from "react";
import Routines from "./Routines.jsx";
import Workspaces from "./Workspaces.jsx";
import Comms from "./Comms.jsx";

const TABS = [
  { id: "routines", label: "Routines" },
  { id: "workspaces", label: "Workspaces" },
  { id: "comms", label: "Comms" },
];

export default function Backstage() {
  const [activeTab, setActiveTab] = useState("routines");

  return (
    <div className="page">
      <header className="page-header">
        <h1>fathom</h1>
        <span className="header-subtitle">backstage</span>
      </header>
      <div className="backstage-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`backstage-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="backstage-content">
        {activeTab === "routines" && <Routines embedded />}
        {activeTab === "workspaces" && <Workspaces />}
        {activeTab === "comms" && <Comms />}
      </div>
    </div>
  );
}
