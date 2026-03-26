import { useState } from "react";
import Routines from "./Routines.jsx";
import Workspaces from "./Workspaces.jsx";
import Comms from "./Comms.jsx";
import Vault from "./Vault.jsx";
import TabBar from "./TabBar.jsx";

const TABS = [
  { id: "workspaces", label: "Workspaces" },
  { id: "routines", label: "Routines" },
  { id: "comms", label: "Comms" },
  { id: "vault", label: "Vault" },
];

export default function Backstage({ onOpenChat }) {
  const [activeTab, setActiveTab] = useState("workspaces");

  return (
    <div className="page">
      <header className="page-header">
        <h1><span className="c-teal">fa</span><span className="c-purple">th</span><span className="c-orange">o</span><span className="c-green">m</span></h1>
        <span className="header-subtitle">backstage</span>
      </header>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <div className="backstage-content">
        {activeTab === "routines" && <Routines embedded />}
        {activeTab === "workspaces" && <Workspaces onOpenChat={onOpenChat} />}
        {activeTab === "comms" && <Comms />}
        {activeTab === "vault" && <Vault />}
      </div>
    </div>
  );
}
