import { useState, useEffect, useCallback } from "react";
import { getPendingPermissions, respondPermission, getWorkspaceProfiles } from "../api/client.js";

function formatDetail(toolName, toolInput) {
  if (!toolInput) return toolName;
  if (toolName === "Bash" && toolInput.command) {
    const cmd = toolInput.command;
    return cmd.length > 120 ? cmd.slice(0, 117) + "..." : cmd;
  }
  if ((toolName === "Edit" || toolName === "Write" || toolName === "Read") && toolInput.file_path) {
    return toolInput.file_path;
  }
  const firstKey = Object.keys(toolInput)[0];
  if (firstKey) {
    const val = String(toolInput[firstKey]);
    const summary = `${firstKey}: ${val}`;
    return summary.length > 120 ? summary.slice(0, 117) + "..." : summary;
  }
  return toolName;
}

function formatCountdown(expiresAt, now) {
  const diff = Math.max(0, Math.floor((new Date(expiresAt) - now) / 1000));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PermissionToasts() {
  const [requests, setRequests] = useState([]);
  const [responding, setResponding] = useState(new Set());
  const [exiting, setExiting] = useState(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [wsColors, setWsColors] = useState({});

  // Fetch workspace colors once
  useEffect(() => {
    getWorkspaceProfiles()
      .then((data) => {
        const profiles = data.profiles || data;
        const colors = {};
        for (const [name, info] of Object.entries(profiles)) {
          if (info?.color) colors[name] = info.color;
        }
        setWsColors(colors);
      })
      .catch(() => {});
  }, []);

  // Tick every second for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll pending permissions
  useEffect(() => {
    let mounted = true;
    const poll = () => {
      getPendingPermissions()
        .then((data) => {
          if (!mounted) return;
          const pending = data.pending || data || [];
          setRequests((prev) => {
            const newIds = new Set(pending.map((r) => r.id));
            // Keep exiting ones briefly, remove truly gone ones
            return pending.concat(
              prev.filter((r) => !newIds.has(r.id) && !exiting.has(r.id))
            ).filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i);
          });
          // Remove requests that disappeared from server (resolved externally)
          setRequests((prev) => {
            const serverIds = new Set(pending.map((r) => r.id));
            const gone = prev.filter((r) => !serverIds.has(r.id) && !exiting.has(r.id));
            if (gone.length > 0) {
              setExiting((ex) => {
                const next = new Set(ex);
                gone.forEach((r) => next.add(r.id));
                return next;
              });
              setTimeout(() => {
                setExiting((ex) => {
                  const next = new Set(ex);
                  gone.forEach((r) => next.delete(r.id));
                  return next;
                });
                setRequests((prev2) => prev2.filter((r) => serverIds.has(r.id)));
              }, 300);
            }
            return prev;
          });
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => { mounted = false; clearInterval(id); };
  }, [exiting]);

  const handleRespond = useCallback((reqId, allow) => {
    if (responding.has(reqId)) return;
    setResponding((s) => new Set(s).add(reqId));
    respondPermission(reqId, allow)
      .then(() => {
        setExiting((s) => new Set(s).add(reqId));
        setTimeout(() => {
          setRequests((prev) => prev.filter((r) => r.id !== reqId));
          setExiting((s) => { const n = new Set(s); n.delete(reqId); return n; });
          setResponding((s) => { const n = new Set(s); n.delete(reqId); return n; });
        }, 300);
      })
      .catch(() => {
        setResponding((s) => { const n = new Set(s); n.delete(reqId); return n; });
      });
  }, [responding]);

  // Filter expired client-side
  const visible = requests.filter((r) => {
    if (!r.expires_at) return true;
    return new Date(r.expires_at).getTime() > now;
  });

  if (visible.length === 0) return null;

  return (
    <div className="permission-toast-container">
      {visible.map((req) => {
        const color = wsColors[req.workspace] || "#888";
        const isExiting = exiting.has(req.id);
        return (
          <div
            key={req.id}
            className={`permission-toast ${isExiting ? "permission-toast-exit" : ""}`}
          >
            <div className="permission-toast-header">
              <span className="permission-toast-dot" style={{ background: color }} />
              <span className="permission-toast-workspace">{req.workspace}</span>
              {req.expires_at && (
                <span className="permission-toast-countdown">
                  {formatCountdown(req.expires_at, now)}
                </span>
              )}
            </div>
            <div className="permission-toast-tool">{req.tool_name}</div>
            <div className="permission-toast-detail">
              {formatDetail(req.tool_name, req.tool_input)}
            </div>
            <div className="permission-toast-actions">
              <button
                className="permission-toast-deny"
                onClick={() => handleRespond(req.id, false)}
                disabled={responding.has(req.id)}
              >
                Deny
              </button>
              <button
                className="permission-toast-approve"
                onClick={() => handleRespond(req.id, true)}
                disabled={responding.has(req.id)}
              >
                Approve
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
