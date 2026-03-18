import { useState, useEffect, useRef, useCallback } from "react";
import { getConnection, saveConnection, clearConnection } from "../lib/connection.js";
import {
  testConnection,
  getSettings,
  updateSettings,
  getPackages,
  installPackage,
  uninstallPackage,
  saveClaudeCredentials,
  deleteClaudeCredentials,
} from "../api/client.js";
import TabBar from "./TabBar.jsx";
import { ATMOSPHERES } from "../data/atmospheres.js";

export default function SettingsModal({ open, onClose, onConnectionChange, isGate, atmosphere, onAtmosphereChange }) {
  const [tab, setTab] = useState("connection");
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const backdropRef = useRef(null);

  // Comms tab state
  const [retention, setRetention] = useState({ unlimited: true, days: 30 });
  const [retentionLoading, setRetentionLoading] = useState(false);

  // Packages tab state
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const pollRef = useRef(null);

  // Claude auth state
  const [claudeAuthMode, setClaudeAuthMode] = useState(null); // 'oauth-token' | 'api-key'
  const [claudeCredential, setClaudeCredential] = useState("");
  const [claudeCredSaving, setClaudeCredSaving] = useState(false);
  const [claudeCredError, setClaudeCredError] = useState("");

  useEffect(() => {
    if (open) {
      const conn = getConnection();
      if (conn) {
        setServerUrl(conn.serverUrl);
        setApiKey(conn.apiKey);
      }
      setTestResult(null);
      if (!isGate) setTab("connection");
    }
  }, [open, isGate]);

  // Load tab data when switching
  useEffect(() => {
    if (!open || isGate) return;
    if (tab === "comms") loadRetention();
    if (tab === "packages") loadPackages();
  }, [tab, open, isGate]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function loadRetention() {
    setRetentionLoading(true);
    try {
      const data = await getSettings();
      const rooms = data.rooms || {};
      setRetention({
        unlimited: rooms.retention_days === null || rooms.retention_days === undefined || rooms.retention_days === 0,
        days: rooms.retention_days || 30,
      });
    } catch {
      // leave defaults
    } finally {
      setRetentionLoading(false);
    }
  }

  async function saveRetention(unlimited, days) {
    try {
      await updateSettings({
        rooms: { retention_days: unlimited ? null : days },
      });
    } catch {
      // silent fail — could add toast later
    }
  }

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true);
    try {
      const data = await getPackages();
      const pkgList = Object.entries(data).map(([name, info]) => ({
        name,
        ...info,
        status: info.installing ? "installing" : info.installed ? "installed" : "available",
      }));
      setPackages(pkgList);
      startPollingIfNeeded(pkgList);
    } catch {
      setPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  function startPollingIfNeeded(pkgs) {
    if (pollRef.current) clearInterval(pollRef.current);
    const installing = pkgs.some((p) => p.status === "installing");
    if (installing) {
      pollRef.current = setInterval(async () => {
        try {
          const data = await getPackages();
          const updated = Object.entries(data).map(([name, info]) => ({
            name,
            ...info,
            status: info.installing ? "installing" : info.installed ? "installed" : "available",
          }));
          setPackages(updated);
          if (!updated.some((p) => p.status === "installing")) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {
          // keep polling
        }
      }, 2000);
    }
  }

  async function handleInstall(name) {
    try {
      await installPackage(name);
      loadPackages();
    } catch {
      // silent
    }
  }

  async function handleUninstall(name) {
    try {
      await uninstallPackage(name);
      loadPackages();
    } catch {
      // silent
    }
  }

  async function handleTest() {
    if (!serverUrl.trim() || !apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const data = await testConnection(serverUrl, apiKey);
      setTestResult({
        ok: true,
        message: `Connected — v${data.version || "?"} — ${data.primaryWorkspace}`,
        data,
      });
    } catch (err) {
      setTestResult({ ok: false, message: err.message || "Connection failed" });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    if (!serverUrl.trim() || !apiKey.trim()) return;
    const d = testResult?.data || {};
    saveConnection({
      serverUrl: serverUrl.trim(),
      apiKey: apiKey.trim(),
      primaryWorkspace: d.primaryWorkspace || d.primary_workspace || "fathom",
      humanUser: d.humanUser,
      humanDisplayName: d.humanDisplayName,
    });
    onConnectionChange();
    if (!isGate) onClose();
  }

  function handleDisconnect() {
    clearConnection();
    setServerUrl("");
    setApiKey("");
    setTestResult(null);
    onConnectionChange();
  }

  function handleBackdropClick(e) {
    if (!isGate && e.target === backdropRef.current) {
      onClose();
    }
  }

  if (!open) return null;

  const connected = !!getConnection();
  const canSave = serverUrl.trim() && apiKey.trim();

  const tabs = [
    { id: "connection", label: "Connection" },
    { id: "themes", label: "Themes" },
    { id: "comms", label: "Comms" },
    { id: "packages", label: "Packages" },
  ];

  return (
    <div
      ref={backdropRef}
      className={`settings-backdrop ${isGate ? "gate" : ""}`}
      onClick={handleBackdropClick}
    >
      <div className={`settings-modal ${isGate ? "gate" : ""}`}>
        <div className="settings-header">
          <h2 className="settings-title">
            {isGate ? "Connect to Fathom" : "Settings"}
          </h2>
          {!isGate && (
            <button className="settings-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {!isGate && (
          <TabBar
            tabs={tabs}
            active={tab}
            onChange={setTab}
            className="settings-tab-bar"
          />
        )}

        <div className="settings-body">
          {/* Connection tab (or gate mode) */}
          {(isGate || tab === "connection") && (
            <>
              {isGate && (
                <p className="settings-gate-desc">
                  Enter your fathom-vault server address and API key to get started.
                </p>
              )}

              <label className="settings-field">
                <span className="settings-label">Server URL</span>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://your-server:4243"
                  autoComplete="url"
                />
              </label>

              <label className="settings-field">
                <span className="settings-label">API Key</span>
                <div className="settings-key-row">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="fv_..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="settings-key-toggle"
                    onClick={() => setShowKey(!showKey)}
                    aria-label={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <path d="M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              {testResult && (
                <div className={`settings-test-result ${testResult.ok ? "ok" : "fail"}`}>
                  {testResult.ok ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="settings-actions">
                <button className="test-btn" onClick={handleTest} disabled={!canSave || testing}>
                  {testing ? "Testing..." : "Test Connection"}
                </button>
                <button className="settings-save-btn" onClick={handleSave} disabled={!canSave}>
                  {isGate ? "Connect" : "Save"}
                </button>
              </div>

              {connected && !isGate && (
                <button className="settings-disconnect-btn" onClick={handleDisconnect}>
                  Disconnect
                </button>
              )}
            </>
          )}

          {/* Themes tab */}
          {!isGate && tab === "themes" && (
            <div className="atmosphere-bar">
              {ATMOSPHERES.map((a, i) => (
                <button
                  key={a.label}
                  className={`atmosphere-btn${atmosphere === i ? " active" : ""}`}
                  onClick={() => onAtmosphereChange(i)}
                >
                  <span className="atmosphere-dot" style={{ background: a.dot }} />
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Comms tab */}
          {!isGate && tab === "comms" && (
            <>
              <h3 className="settings-section-title">Room Retention</h3>
              {retentionLoading ? (
                <p className="settings-loading">Loading...</p>
              ) : (
                <>
                  <label className="settings-toggle-row">
                    <span>Unlimited retention</span>
                    <button
                      type="button"
                      className={`settings-toggle ${retention.unlimited ? "on" : ""}`}
                      onClick={() => {
                        const next = !retention.unlimited;
                        setRetention((r) => ({ ...r, unlimited: next }));
                        saveRetention(next, retention.days);
                      }}
                      aria-label="Toggle unlimited retention"
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                  </label>

                  {!retention.unlimited && (
                    <label className="settings-field">
                      <span className="settings-label">Retention (days)</span>
                      <input
                        type="number"
                        className="settings-number-input"
                        min={1}
                        max={60}
                        value={retention.days}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (v >= 1 && v <= 60) setRetention((r) => ({ ...r, days: v }));
                        }}
                        onBlur={() => saveRetention(false, retention.days)}
                      />
                    </label>
                  )}
                </>
              )}
            </>
          )}

          {/* Packages tab */}
          {!isGate && tab === "packages" && (
            <>
              <h3 className="settings-section-title">Packages</h3>
              {packagesLoading && packages.length === 0 ? (
                <p className="settings-loading">Loading...</p>
              ) : packages.length === 0 ? (
                <p className="settings-loading">No packages available</p>
              ) : (
                packages.map((pkg) => (
                  <div key={pkg.name} className="settings-pkg-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div className="settings-pkg-info">
                        <span
                          className={`settings-pkg-dot ${
                            pkg.status === "installed" && pkg.authenticated !== false
                              ? "installed"
                              : pkg.status === "installed" && pkg.authenticated === false
                                ? "warning"
                                : pkg.status === "installing"
                                  ? "installing"
                                  : ""
                          }`}
                        />
                        <div>
                          <span className="settings-pkg-name">{pkg.label || pkg.name}</span>
                          {pkg.status === "installing" && pkg.progress && (
                            <span className="settings-pkg-progress">{pkg.progress}</span>
                          )}
                        </div>
                      </div>
                      <div className="settings-pkg-actions">
                        {pkg.status === "installed" ? (
                          <button
                            className="settings-pkg-btn uninstall"
                            onClick={() => handleUninstall(pkg.name)}
                          >
                            Uninstall
                          </button>
                        ) : pkg.status === "installing" ? (
                          <span className="settings-pkg-status">Installing...</span>
                        ) : (
                          <button
                            className="settings-pkg-btn install"
                            onClick={() => handleInstall(pkg.name)}
                          >
                            Install
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Claude auth — authenticated */}
                    {pkg.name === "claude" && pkg.status === "installed" && pkg.authenticated === true && !claudeAuthMode && (
                      <div className="settings-claude-auth authenticated">
                        <span className="settings-claude-auth-label">
                          Authenticated
                          <span className="settings-claude-auth-method">
                            via {pkg.auth_method === "api-key" ? "API key" : pkg.auth_method === "oauth-token" ? "OAuth token" : "credentials file"}
                          </span>
                        </span>
                        <span className="settings-claude-auth-actions">
                          <button onClick={() => setClaudeAuthMode("change")}>Change</button>
                          <span className="sep">|</span>
                          <button
                            className="danger"
                            onClick={async () => {
                              if (!confirm("Remove Claude Code credentials?")) return;
                              try { await deleteClaudeCredentials(); loadPackages(); } catch { /* silent */ }
                            }}
                          >
                            Remove
                          </button>
                        </span>
                      </div>
                    )}

                    {/* Claude auth — not authenticated or changing */}
                    {pkg.name === "claude" && pkg.status === "installed" && (pkg.authenticated === false || claudeAuthMode === "change") && (
                      <div className="settings-claude-auth unauthenticated">
                        {pkg.authenticated === false && <p className="settings-claude-auth-warning">Not authenticated</p>}
                        {claudeAuthMode === "change" && <p className="settings-claude-auth-warning" style={{ color: "var(--text-secondary)" }}>Change credentials</p>}

                        {(!claudeAuthMode || claudeAuthMode === "change") && (
                          <div className="settings-claude-auth-options">
                            <button className="settings-claude-auth-opt" onClick={() => setClaudeAuthMode("oauth-token")}>
                              <span>Claude account token</span>
                              <span className="hint">uses your Pro/Max plan</span>
                            </button>
                            <button className="settings-claude-auth-opt" onClick={() => setClaudeAuthMode("api-key")}>
                              <span>API key</span>
                              <span className="hint">pay-per-token billing</span>
                            </button>
                          </div>
                        )}

                        {claudeAuthMode && claudeAuthMode !== "change" && (
                          <div className="settings-claude-auth-input">
                            {claudeAuthMode === "oauth-token" && (
                              <p className="settings-claude-auth-help">
                                On a machine where you're logged into Claude Code, run:
                                <code
                                  onClick={(e) => { navigator.clipboard.writeText(e.target.textContent); }}
                                >cat ~/.claude/.credentials.json | python3 -c "import sys,json; print(json.load(sys.stdin)['claudeAiOauth']['accessToken'])"</code>
                              </p>
                            )}
                            <div className="settings-claude-auth-form">
                              <input
                                type="password"
                                placeholder={claudeAuthMode === "api-key" ? "sk-ant-..." : "Paste token..."}
                                value={claudeCredential}
                                onChange={(e) => { setClaudeCredential(e.target.value); setClaudeCredError(""); }}
                              />
                              <button
                                disabled={!claudeCredential || claudeCredSaving}
                                onClick={async () => {
                                  setClaudeCredSaving(true);
                                  setClaudeCredError("");
                                  try {
                                    const res = await saveClaudeCredentials(claudeCredential, claudeAuthMode);
                                    if (res.error) { setClaudeCredError(res.error); return; }
                                    setClaudeCredential("");
                                    setClaudeAuthMode(null);
                                    loadPackages();
                                  } catch {
                                    setClaudeCredError("Failed to save");
                                  } finally {
                                    setClaudeCredSaving(false);
                                  }
                                }}
                              >
                                {claudeCredSaving ? "..." : "Save"}
                              </button>
                            </div>
                            {claudeCredError && <p className="settings-claude-auth-error">{claudeCredError}</p>}
                            <button
                              className="settings-claude-auth-back"
                              onClick={() => { setClaudeAuthMode(null); setClaudeCredential(""); setClaudeCredError(""); }}
                            >
                              ← back
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
