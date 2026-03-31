import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { getWorkspaceProfiles, getRoutines, fireRoutine, getBrowserSessions } from "../api/client.js";
import { RoutineRow } from "./Routines.jsx";
import { timeAgo, prettyName } from "../lib/formatters.js";

function TypingDots() {
  return (
    <span className="workspace-typing-dots">
      <span />
      <span />
      <span />
    </span>
  );
}

function getProfileStatus(profile) {
  if (profile.enabled === false) {
    return { status: "disabled", label: "disabled" };
  }
  const now = Date.now() / 1000;
  const lastEvent = profile.last_event_at || 0;
  const isStreaming = lastEvent > 0 && (now - lastEvent) < 30;
  if (isStreaming) {
    return { status: "streaming", label: "streaming" };
  }
  return { status: "ready", label: "ready" };
}


function BrowserTabs({ sessions, vncUrl }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <div className="browser-tabs">
      {sessions.map((s) => (
        <a
          key={s.id}
          className="browser-tab"
          href={vncUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="browser-tab-info">
            <span className="browser-tab-title">{s.title || s.id}</span>
            <span className="browser-tab-url">{s.url || `${s["browser-type"] || "chrome"} · ${s.headed === "true" ? "headed" : "headless"}`}</span>
          </div>
          <span className="browser-tab-debug">vnc</span>
        </a>
      ))}
    </div>
  );
}

function WorkspaceCard({ name, workspace, onSelect, onOpenChat, browserSessions, vncUrl, isPrimary }) {
  if (workspace.type === "human") return null;

  const wsColor = workspace.color || "#888";
  const displayName = workspace.display_name || prettyName(name);
  const description = workspace.description || "";
  const { status, label: statusLabel } = getProfileStatus(workspace);
  const hasAgent = workspace.agents && workspace.agents.length > 0;
  const isDisabled = workspace.enabled === false;

  return (
    <div>
      <div
        className={`workspace-card${isDisabled ? " disabled" : ""}`}
        style={{ backgroundImage: `linear-gradient(${wsColor}35, ${wsColor}35)` }}
        onClick={isDisabled ? undefined : () => onSelect(name, workspace)}
      >
        <div className="workspace-card-content">
          <span className="workspace-card-name-row">
            {displayName}
            <span className="workspace-card-slug">{name}</span>
            {isDisabled && <span className="workspace-badge disabled">Disabled</span>}
          </span>
          <span className="workspace-card-badges">
            {isPrimary && <span className="workspace-badge primary">Primary</span>}
            {workspace.ssh && <span className="workspace-badge ssh">SSH</span>}
            {workspace.browser && <span className="workspace-badge browser">Browser</span>}
          </span>
          {description && <p className="workspace-card-desc">{description}</p>}
        </div>
        <div
          className={`workspace-card-sidebar${hasAgent && onOpenChat ? " clickable" : ""}`}
          onClick={hasAgent && onOpenChat ? (e) => { e.stopPropagation(); onOpenChat(name); } : undefined}
        >
          <MessageCircle size={16} className="workspace-chat-icon" />
          <div className="workspace-status-indicator">
            {status === "streaming" ? <TypingDots /> : (
              <span className="workspace-status-label">{statusLabel}</span>
            )}
          </div>
        </div>
      </div>
      {workspace.browser && <BrowserTabs sessions={browserSessions} vncUrl={vncUrl} />}
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
    try {
      await fireRoutine(id);
      const data = await getRoutines();
      const all = [...(data.recent || []), ...(data.upcoming || []), ...(data.disabled || [])];
      setRoutines(all.filter((r) => r.workspace === name));
    } catch (err) {
      console.error(err);
    }
  }

  const wsColor = workspace.color || "#888";
  const displayName = workspace.display_name || prettyName(name);
  const { status, label: statusLabel } = getProfileStatus(workspace);
  const lastHeartbeat = workspace.last_heartbeat ? timeAgo(workspace.last_heartbeat) : null;

  return (
    <div className={`feed-panel-backdrop ${visible ? "visible" : ""}`} onClick={handleClose}>
      <div className={`feed-panel ${visible ? "visible" : ""}`} style={{ backgroundImage: `linear-gradient(${wsColor}35, ${wsColor}35)` }} onClick={(e) => e.stopPropagation()}>
        <div className="feed-panel-scroll">
          <div className="feed-panel-header">
            <button className="feed-panel-dismiss" onClick={handleClose} aria-label="Close">
              <X size={14} />
              <span>Close</span>
            </button>
          </div>

          <div className="workspace-detail-header">
            <div>
              <h2 className="workspace-detail-name">
                {displayName}
                <span className="workspace-detail-slug">{name}</span>
              </h2>
              <span className="workspace-card-badges">
                {isPrimary && <span className="workspace-badge primary">Primary</span>}
                {workspace.ssh && <span className="workspace-badge ssh">SSH</span>}
                {workspace.browser && <span className="workspace-badge browser">Browser</span>}
              </span>
            </div>
          </div>

          {workspace.description && (
            <p className="workspace-detail-desc">{workspace.description}</p>
          )}

          <div className="workspace-detail-fields">
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Status</span>
              <span className="workspace-detail-field-value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {status === "streaming" ? <TypingDots /> : statusLabel}
              </span>
            </div>
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
  const [vncUrl, setVncUrl] = useState("");

  useEffect(() => {
    getWorkspaceProfiles()
      .then((data) => setWorkspaces(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    getBrowserSessions().then((data) => {
      setBrowserSessions(data.sessions || []);
      if (data.vnc_url) setVncUrl(data.vnc_url);
    }).catch(() => {});
    const interval = setInterval(() => {
      getWorkspaceProfiles()
        .then((data) => setWorkspaces(data))
        .catch(() => {});
      getBrowserSessions().then((data) => {
        setBrowserSessions(data.sessions || []);
        if (data.vnc_url) setVncUrl(data.vnc_url);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading">loading...</div>;
  if (error) return <div className="empty-state">{error}</div>;

  const defaultWorkspace = workspaces?.default_workspace;
  const entries = workspaces
    ? Object.entries(workspaces.profiles || {})
        .filter(([, v]) => typeof v === "object" && v.type !== "human")
        .sort((a, b) => {
          const sa = getProfileStatus(a[1]).status;
          const sb = getProfileStatus(b[1]).status;
          const order = { streaming: 0, ready: 1, disabled: 2 };
          return (order[sa] ?? 1) - (order[sb] ?? 1);
        })
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
          browserSessions={ws.browser ? browserSessions.filter((s) => s.workspace === name || s.workspace.startsWith(name + "-")) : []}
          vncUrl={vncUrl}
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
