import { useState, useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { getWorkspaceProfiles, getRoutines, fireRoutine, getBrowserSessions } from "../api/client.js";
import { RoutineRow } from "./Routines.jsx";
import { timeAgo } from "../lib/formatters.js";

function getProfileStatus(profile) {
  const { execution, process, connected } = profile;
  if (execution === "local") {
    if (process && connected) return { status: "running", color: "#4ADE80", label: "active", pulse: false };
    if (process) return { status: "process-only", color: "#FBBF24", label: "busy", pulse: true };
    if (connected) return { status: "ws-only", color: "#FBBF24", label: "idle", pulse: true };
    return { status: "offline", color: "rgba(168,212,180,0.3)", label: "offline", pulse: false };
  }
  // execution === "none" or other
  if (connected) return { status: "running", color: "#4ADE80", label: "active", pulse: false };
  return { status: "offline", color: "rgba(168,212,180,0.3)", label: "offline", pulse: false };
}


function BrowserTabs({ sessions }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <div className="browser-tabs">
      {sessions.map((s) => (
        <a
          key={s.id}
          className="browser-tab"
          href={s.debug_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {s.favicon && <img className="browser-tab-favicon" src={s.favicon} alt="" />}
          <div className="browser-tab-info">
            <span className="browser-tab-title">{s.title || "Untitled"}</span>
            <span className="browser-tab-url">{s.url}</span>
          </div>
          <span className="browser-tab-debug">inspect</span>
        </a>
      ))}
    </div>
  );
}

function WorkspaceCard({ name, workspace, onSelect, onOpenChat, browserSessions, isPrimary }) {
  if (workspace.type === "human") return null;

  const wsColor = workspace.color || "#888";
  const displayName = workspace.display_name || name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const description = workspace.description || "";
  const { color: statusColor, label: statusLabel, pulse } = getProfileStatus(workspace);
  const hasAgent = workspace.agents && workspace.agents.length > 0;

  return (
    <div>
      <div className="workspace-card" onClick={() => onSelect(name, workspace)}>
        <div className="workspace-card-header">
          <div className="workspace-card-names">
            <span className="workspace-card-name-row">
              <span className="workspace-color-dot" style={{ background: wsColor }} />
              {displayName}
              {isPrimary && <span className="workspace-badge primary">Primary</span>}
              {workspace.ssh && <span className="workspace-badge ssh">SSH</span>}
              {workspace.browser && <span className="workspace-badge browser">Browser</span>}
            </span>
            <span className="workspace-card-slug">{name}</span>
          </div>
          <div className="workspace-card-actions">
            {hasAgent && onOpenChat && (
              <button
                className="workspace-chat-btn"
                onClick={(e) => { e.stopPropagation(); onOpenChat(name); }}
                aria-label={`Chat with ${displayName}`}
              >
                <MessageSquare size={16} />
              </button>
            )}
            <div className="workspace-status-indicator">
              <span className={`workspace-status-dot${pulse ? " pulse" : ""}`} style={{ background: statusColor }} />
              <span className="workspace-status-label">{statusLabel}</span>
            </div>
          </div>
        </div>
        {description && <p className="workspace-card-desc">{description}</p>}
      </div>
      {workspace.browser && <BrowserTabs sessions={browserSessions} />}
    </div>
  );
}

function WorkspaceDetailPanel({ name, workspace, onClose, isPrimary }) {
  const [visible, setVisible] = useState(false);
  const [routines, setRoutines] = useState([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    getRoutines().then((data) => {
      const all = [...(data.recent || []), ...(data.upcoming || []), ...(data.disabled || [])];
      setRoutines(all.filter((r) => r.workspace === name));
    }).catch(() => {});
  }, [name]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  async function handleFire(id) {
    await fireRoutine(id);
    const data = await getRoutines();
    const all = [...(data.recent || []), ...(data.upcoming || []), ...(data.disabled || [])];
    setRoutines(all.filter((r) => r.workspace === name));
  }

  const wsColor = workspace.color || "#888";
  const displayName = workspace.display_name || name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { color: statusColor, label: statusLabel, pulse } = getProfileStatus(workspace);
  const lastPing = workspace.last_ping ? timeAgo(workspace.last_ping) : null;
  const lastHeartbeat = workspace.last_heartbeat ? timeAgo(workspace.last_heartbeat) : null;

  return (
    <div className={`feed-panel-backdrop ${visible ? "visible" : ""}`} onClick={handleClose}>
      <div className={`feed-panel ${visible ? "visible" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="feed-panel-scroll">
          <div className="feed-panel-top-actions">
            <button className="feed-panel-close" onClick={handleClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div className="workspace-detail-header">
            <div>
              <h2 className="workspace-detail-name">
                <span className="workspace-color-dot large" style={{ background: wsColor }} />
                {displayName}
                {isPrimary && <span className="workspace-badge primary">Primary</span>}
                {workspace.ssh && <span className="workspace-badge ssh">SSH</span>}
                {workspace.browser && <span className="workspace-badge browser">Browser</span>}
              </h2>
              <span className="workspace-detail-slug">{name}</span>
            </div>
          </div>

          <div className="workspace-detail-status">
            <span className={`workspace-status-dot${pulse ? " pulse" : ""}`} style={{ background: statusColor }} />
            <span className="workspace-status-label">{statusLabel}</span>
            {lastPing && <span className="workspace-detail-ping">Last ping: {lastPing}</span>}
          </div>

          {workspace.description && (
            <p className="workspace-detail-desc">{workspace.description}</p>
          )}

          <div className="workspace-detail-fields">
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Type</span>
              <span className="workspace-detail-field-value">{workspace.type || "synced"}</span>
            </div>
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Execution</span>
              <span className="workspace-detail-field-value">{workspace.execution || "local"}</span>
            </div>
            {workspace.agents && workspace.agents.length > 0 && (
              <div className="workspace-detail-field">
                <span className="workspace-detail-field-label">Agent</span>
                <span className="workspace-detail-field-value">{workspace.agents.join(", ")}</span>
              </div>
            )}
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Vault</span>
              <span className="workspace-detail-field-value">{workspace.vault || "vault"}</span>
            </div>
            {workspace.path && (
              <div className="workspace-detail-field">
                <span className="workspace-detail-field-label">Path</span>
                <span className="workspace-detail-field-value workspace-detail-path">{workspace.path}</span>
              </div>
            )}
            {workspace.ssh && (
              <div className="workspace-detail-field">
                <span className="workspace-detail-field-label">SSH</span>
                <span className="workspace-detail-field-value workspace-detail-path">{workspace.ssh}</span>
              </div>
            )}
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Color</span>
              <span className="workspace-detail-field-value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: wsColor }} />
                {wsColor}
              </span>
            </div>
            {lastHeartbeat && (
              <div className="workspace-detail-field">
                <span className="workspace-detail-field-label">Last heartbeat</span>
                <span className="workspace-detail-field-value">{lastHeartbeat}</span>
              </div>
            )}
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Process</span>
              <span className="workspace-detail-field-value">{workspace.process ? "running" : "stopped"}</span>
            </div>
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">WebSocket</span>
              <span className="workspace-detail-field-value">{workspace.connected ? "connected" : "disconnected"}</span>
            </div>
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Browser</span>
              <span className="workspace-detail-field-value">{workspace.browser ? "enabled" : "disabled"}</span>
            </div>
          </div>

          {routines.length > 0 && (
            <div className="workspace-detail-routines">
              <div className="workspace-detail-section-label">Routines</div>
              <div className="routine-cluster">
                {routines.map((r) => (
                  <RoutineRow key={r.id} routine={r} onFire={handleFire} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Workspaces({ onOpenChat }) {
  const [workspaces, setWorkspaces] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [browserSessions, setBrowserSessions] = useState([]);

  useEffect(() => {
    getWorkspaceProfiles()
      .then((data) => setWorkspaces(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    getBrowserSessions().then((data) => setBrowserSessions(data.sessions || [])).catch(() => {});
    const interval = setInterval(() => {
      getBrowserSessions().then((data) => setBrowserSessions(data.sessions || [])).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading">loading...</div>;
  if (error) return <div className="empty-state">{error}</div>;

  const defaultWorkspace = workspaces?.default_workspace;
  const entries = workspaces
    ? Object.entries(workspaces.profiles || {})
        .filter(([, v]) => typeof v === "object" && v.type !== "human")
    : [];

  if (entries.length === 0) {
    return <div className="empty-state">No workspaces configured.</div>;
  }

  return (
    <div className="workspaces-list">
      <div className="workspace-config-banner">
        Workspace and routine config is managed by Fathom via <code>workspaces.json</code>
      </div>
      {entries.map(([name, ws]) => (
        <WorkspaceCard
          key={name}
          name={name}
          workspace={ws}
          isPrimary={name === defaultWorkspace}
          onSelect={(n, w) => setSelected({ name: n, workspace: w })}
          onOpenChat={onOpenChat}
          browserSessions={ws.browser ? browserSessions : []}
        />
      ))}
      {selected && (
        <WorkspaceDetailPanel
          name={selected.name}
          workspace={selected.workspace}
          isPrimary={selected.name === defaultWorkspace}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
