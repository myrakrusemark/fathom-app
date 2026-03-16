import { useState, useEffect } from "react";
import { getWorkspaceProfiles } from "../api/client.js";

function WorkspaceCard({ name, workspace }) {
  const isRunning = workspace.running || false;
  const description = workspace.description || "";
  const type = workspace.type || "synced";

  // Skip human entries
  if (type === "human") return null;

  return (
    <div className="workspace-card">
      <div className="workspace-card-header">
        <span className={`workspace-dot ${isRunning ? "pulse" : ""}`} style={{ background: isRunning ? "#10b981" : "#9ca3af" }} />
        <span className="workspace-card-name">{name}</span>
        <span className={`workspace-status ${isRunning ? "running" : "stopped"}`}>
          {isRunning ? "running" : "stopped"}
        </span>
      </div>
      {description && <p className="workspace-card-desc">{description}</p>}
    </div>
  );
}

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getWorkspaceProfiles()
      .then((data) => {
        setWorkspaces(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">loading...</div>;
  if (error) return <div className="empty-state">{error}</div>;

  // Handle different response shapes from the API
  const entries = workspaces
    ? Object.entries(workspaces.workspaces || workspaces.profiles || workspaces)
        .filter(([, v]) => typeof v === "object")
    : [];

  if (entries.length === 0) {
    return <div className="empty-state">No workspaces configured.</div>;
  }

  return (
    <div className="workspaces-list">
      {entries.map(([name, ws]) => (
        <WorkspaceCard key={name} name={name} workspace={ws} />
      ))}
    </div>
  );
}
