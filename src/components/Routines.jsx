import { useState, useEffect } from "react";
import { getRoutines, fireRoutine } from "../api/client.js";

function timeAgo(timestamp) {
  if (!timestamp) return "never";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function timeUntil(timestamp) {
  if (!timestamp) return "";
  const diff = new Date(timestamp).getTime() - Date.now();
  if (diff < 0) return "overdue";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `in ${hours}h`;
}

function frequencyLabel(r) {
  return r.frequency || "on demand";
}

function RoutineRow({ routine, onFire }) {
  const [expanded, setExpanded] = useState(false);
  const [firing, setFiring] = useState(false);
  const color = routine.workspace_color || "#888";

  async function handleFire(e) {
    e.stopPropagation();
    setFiring(true);
    try {
      await onFire(routine.id);
    } finally {
      setFiring(false);
    }
  }

  const statusIcon = routine.recently_fired
    ? "fired"
    : routine.conditional
      ? "conditional"
      : !routine.enabled
        ? "disabled"
        : "waiting";

  return (
    <div
      className={`routine-row ${statusIcon}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="routine-row-main">
        <span className="routine-dot" style={{ backgroundColor: color }} />
        <div className="routine-info">
          <span className="routine-name">{routine.name}</span>
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
      {expanded && (
        <div className="routine-detail">
          <p className="routine-description">{routine.description}</p>
          <button
            className="fire-btn"
            onClick={handleFire}
            disabled={firing}
          >
            {firing ? "firing..." : "fire now"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Routines() {
  const [data, setData] = useState({ recent: [], upcoming: [], disabled: [] });
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="page">
      <header className="page-header">
        <h1>fathom</h1>
        <span className="header-subtitle">routines</span>
      </header>
      <div className="routines-list">
        {data.recent.length > 0 && (
          <section>
            <h2 className="routines-section-label">recently fired</h2>
            <div className="routine-cluster">
              {data.recent.map((r) => (
                <RoutineRow key={r.id} routine={r} onFire={handleFire} />
              ))}
            </div>
          </section>
        )}
        {data.upcoming.length > 0 && (
          <section>
            <h2 className="routines-section-label">upcoming</h2>
            <div className="routine-cluster">
              {data.upcoming.map((r) => (
                <RoutineRow key={r.id} routine={r} onFire={handleFire} />
              ))}
            </div>
          </section>
        )}
        {data.disabled.length > 0 && (
          <section>
            <h2 className="routines-section-label">disabled</h2>
            <div className="routine-cluster">
              {data.disabled.map((r) => (
                <RoutineRow key={r.id} routine={r} onFire={handleFire} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
