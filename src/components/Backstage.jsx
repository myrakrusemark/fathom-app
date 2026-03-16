import { useState } from "react";
import Routines from "./Routines.jsx";
import Workspaces from "./Workspaces.jsx";
import Comms from "./Comms.jsx";
import Vault from "./Vault.jsx";
import TabBar from "./TabBar.jsx";

const TABS = [
  { id: "routines", label: "Routines" },
  { id: "workspaces", label: "Workspaces" },
  { id: "comms", label: "Comms" },
  { id: "vault", label: "Vault" },
];

export default function Backstage() {
  const [activeTab, setActiveTab] = useState("routines");

  return (
    <div className="page">
      <header className="page-header">
        <h1>fathom</h1>
        <span className="header-subtitle">backstage</span>
      </header>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <div className="backstage-content">
        {activeTab === "routines" && <Routines embedded />}
        {activeTab === "workspaces" && <Workspaces />}
        {activeTab === "comms" && <Comms />}
        {activeTab === "vault" && <Vault />}
      </div>
    </div>
  );
}
