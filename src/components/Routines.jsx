import { useState, useEffect } from "react";
import { X, Play, Clock } from "lucide-react";
import { getRoutines, fireRoutine } from "../api/client.js";
import { timeAgo as timeAgoFn, timeUntil, formatTimestamp } from "../lib/formatters.js";

function timeAgo(timestamp) {
  return timeAgoFn(timestamp) || "never";
}

function frequencyLabel(r) {
  return r.frequency || "on demand";
}

function RoutineDetailPanel({ routine, onClose, onFire }) {
  const [visible, setVisible] = useState(false);
  const [firing, setFiring] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  async function handleFire() {
    if (firing) return;
    setFiring(true);
    try {
      await onFire(routine.id);
    } catch (err) {
      console.error(err);
    } finally {
      setFiring(false);
    }
  }

  const color = routine.workspace_color || "#888";
  const enabled = routine.enabled !== false;
  const schedule = routine.schedule || null;
  const conditions = routine.conditions || [];
  const cs = routine.context_sources || {};
  const texts = cs.texts || [];
  const scripts = cs.scripts || [];
  const injectTime = cs.time !== false;

  const hasPromptSources = injectTime || scripts.length > 0 || texts.length > 0;
  const hasConditions = conditions.length > 0;

  return (
    <div className={`feed-panel-backdrop ${visible ? "visible" : ""}`} onClick={handleClose}>
      <div className={`feed-panel ${visible ? "visible" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="feed-panel-scroll">
          <div className="feed-panel-top-actions">
            <button className="feed-panel-close" onClick={handleClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div className="routine-detail-header">
            <h2 className="routine-detail-name">{routine.name}</h2>
            <span className="routine-detail-workspace">
              <span className="workspace-color-dot" style={{ background: color }} />
              {routine.workspace_name}
            </span>
          </div>

          <button
            className="routine-detail-fire-btn"
            onClick={handleFire}
            disabled={firing}
          >
            {firing ? "Firing..." : "Fire now"}
          </button>

          <div className="routine-detail-status">
            <span
              className="routine-detail-status-dot"
              style={{ background: enabled ? "#4ADE80" : "rgba(168,212,180,0.3)" }}
            />
            <span>{enabled ? "Enabled" : "Disabled"}</span>
            {schedule && <span className="routine-detail-schedule-pill">{schedule}</span>}
          </div>

          {routine.description && (
            <p className="routine-detail-desc">{routine.description}</p>
          )}

          <div className="workspace-detail-fields">
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Schedule</span>
              <span className="workspace-detail-field-value">
                <code>{schedule || "on demand"}</code>
              </span>
            </div>
            {routine.interval_minutes != null && (
              <div className="workspace-detail-field">
                <span className="workspace-detail-field-label">Interval</span>
                <span className="workspace-detail-field-value">{routine.interval_minutes} min</span>
              </div>
            )}
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Single fire</span>
              <span className="workspace-detail-field-value">{routine.single_fire ? "yes" : "no"}</span>
            </div>
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Last fired</span>
              <span className="workspace-detail-field-value">{formatTimestamp(routine.last_fire_at)}</span>
            </div>
            <div className="workspace-detail-field">
              <span className="workspace-detail-field-label">Next fire</span>
              <span className="workspace-detail-field-value">{formatTimestamp(routine.next_ping_at)}</span>
            </div>
          </div>

          {hasConditions && (
            <div className="routine-detail-context">
              <div className="workspace-detail-section-label">Conditions</div>
              <div className="routine-prompt-sources">
                {conditions.map((c, i) => (
                  <div key={i} className={`routine-prompt-source ${c.enabled === false ? "disabled" : ""}`}>
                    <div className="routine-prompt-source-header">
                      <span className="routine-prompt-source-type">gate</span>
                      <span className="routine-prompt-source-label">{c.label || "Condition"}</span>
                      {c.enabled === false && <span className="routine-prompt-source-off">off</span>}
                    </div>
                    <code className="routine-prompt-source-cmd">{c.command}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasPromptSources && (
            <div className="routine-detail-context">
              <div className="workspace-detail-section-label">Prompt</div>
              <div className="routine-prompt-sources">
                {injectTime && (
                  <div className="routine-prompt-source">
                    <div className="routine-prompt-source-header">
                      <span className="routine-prompt-source-type">inject</span>
                      <span className="routine-prompt-source-label">Current date & time</span>
                    </div>
                  </div>
                )}
                {scripts.map((s, i) => (
                  <div key={`s${i}`} className={`routine-prompt-source ${s.enabled === false ? "disabled" : ""}`}>
                    <div className="routine-prompt-source-header">
                      <span className="routine-prompt-source-type">script</span>
                      <span className="routine-prompt-source-label">{s.label || "Script"}</span>
                      {s.enabled === false && <span className="routine-prompt-source-off">off</span>}
                    </div>
                    <code className="routine-prompt-source-cmd">{s.command}</code>
                  </div>
                ))}
                {texts.map((t, i) => (
                  <div key={`t${i}`} className={`routine-prompt-source ${t.enabled === false ? "disabled" : ""}`}>
                    <div className="routine-prompt-source-header">
                      <span className="routine-prompt-source-type">text</span>
                      <span className="routine-prompt-source-label">{t.label || `Block ${i + 1}`}</span>
                      {t.enabled === false && <span className="routine-prompt-source-off">off</span>}
                    </div>
                    <pre className="routine-context-content">{t.content}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RoutineRow({ routine, onFire, onSelect }) {
  const [firing, setFiring] = useState(false);
  const color = routine.workspace_color || "#888";

  async function handleFire(e) {
    e.stopPropagation();
    if (firing) return;
    setFiring(true);
    try {
      await onFire(routine.id);
    } catch (err) {
      console.error(err);
    } finally {
      setFiring(false);
    }
  }

  return (
    <div
      className={`routine-row ${!routine.enabled ? "disabled" : ""}`}
      onClick={() => onSelect?.(routine)}
    >
      <div className="routine-row-main">
        <button
          className={`routine-play-btn ${firing ? "firing" : ""}`}
          onClick={handleFire}
          disabled={firing}
          aria-label={`Fire ${routine.name}`}
          style={{ color }}
        >
          {firing ? (
            <Clock size={16} opacity={0.3} />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        <div className="routine-info">
          <span className="routine-name">
            {routine.name}
            {routine.conditional && <span className="workspace-badge conditional">Conditional</span>}
          </span>
          <span className="routine-workspace">{routine.workspace_name}</span>
        </div>
        <div className="routine-timing">
          <span className="routine-schedule">{frequencyLabel(routine)}</span>
          <span className="routine-ago">
            {routine.recently_fired
              ? `fired ${timeAgo(routine.last_fire_at)}`
              : routine.enabled
                ? timeUntil(routine.next_ping_at)
                : "paused"}
          </span>
        </div>
      </div>
    </div>
  );
}

function matchesFilter(routine, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (routine.name || "").toLowerCase().includes(q) ||
    (routine.workspace_name || "").toLowerCase().includes(q) ||
    (routine.description || "").toLowerCase().includes(q)
  );
}

export default function Routines({ embedded = false }) {
  const [data, setData] = useState({ recent: [], upcoming: [], disabled: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const [condFilter, setCondFilter] = useState("all"); // "all" | "cond" | "uncond"

  function load() {
    getRoutines()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function handleFire(id) {
    await fireRoutine(id);
    load();
  }

  if (loading) {
    if (embedded) return <div className="loading">loading...</div>;
    return (
      <div className="page">
        <header className="page-header">
          <h1>fathom</h1>
          <span className="header-subtitle">routines</span>
        </header>
        <div className="loading">loading...</div>
      </div>
    );
  }

  function applyFilters(list) {
    return list.filter((r) => {
      if (!matchesFilter(r, filter)) return false;
      if (condFilter === "cond" && !r.conditional) return false;
      if (condFilter === "uncond" && r.conditional) return false;
      return true;
    });
  }
  const recent = applyFilters(data.recent);
  const upcoming = applyFilters(data.upcoming);
  const disabled = applyFilters(data.disabled);

  const routinesList = (
    <div className="routines-list">
      <div className="config-banner">
        Routine config is managed by Fathom via <code>workspaces.json</code>
      </div>
      <div className="routines-filter-bar">
        <input
          className="routines-filter"
          type="text"
          placeholder="Filter routines..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter routines"
        />
        <div className="routines-filter-chips">
          <button
            className={`routines-chip ${condFilter === "all" ? "active" : ""}`}
            onClick={() => setCondFilter("all")}
          >all</button>
          <button
            className={`routines-chip ${condFilter === "cond" ? "active" : ""}`}
            onClick={() => setCondFilter("cond")}
          >conditional</button>
          <button
            className={`routines-chip ${condFilter === "uncond" ? "active" : ""}`}
            onClick={() => setCondFilter("uncond")}
          >scheduled</button>
        </div>
      </div>
      {recent.length > 0 && (
        <section>
          <h2 className="routines-section-label">recently fired</h2>
          {recent.map((r) => (
            <RoutineRow key={r.id} routine={r} onFire={handleFire} onSelect={setSelected} />
          ))}
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <h2 className="routines-section-label">upcoming</h2>
          {upcoming.map((r) => (
            <RoutineRow key={r.id} routine={r} onFire={handleFire} onSelect={setSelected} />
          ))}
        </section>
      )}
      {disabled.length > 0 && (
        <section>
          <h2 className="routines-section-label">disabled</h2>
          {disabled.map((r) => (
            <RoutineRow key={r.id} routine={r} onFire={handleFire} onSelect={setSelected} />
          ))}
        </section>
      )}
      {(filter || condFilter !== "all") && recent.length === 0 && upcoming.length === 0 && disabled.length === 0 && (
        <div className="empty-state">No matching routines</div>
      )}
    </div>
  );

  const panel = selected && (
    <RoutineDetailPanel
      routine={selected}
      onClose={() => setSelected(null)}
      onFire={handleFire}
    />
  );

  if (embedded) {
    return (
      <div className="routines-embedded">
        {routinesList}
        {panel}
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>fathom</h1>
        <span className="header-subtitle">routines</span>
      </header>
      {routinesList}
      {panel}
    </div>
  );
}
