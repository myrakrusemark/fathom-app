import { useState, useEffect, useRef, useCallback } from "react";
import { getConnection, saveConnection, clearConnection } from "../lib/connection.js";
import {
  testConnection,
  getSettings,
  updateSettings,
  getPackages,
} from "../api/client.js";
import TabBar from "./TabBar.jsx";
import PackageRow from "./PackageRow.jsx";

export default function SettingsModal({ open, onClose, onConnectionChange, isGate, themes, selectedTheme, onThemeChange, showBackstage, onShowBackstageChange }) {
  const [tab, setTab] = useState("connection");
  const defaultServerUrl = `${window.location.protocol}//${window.location.hostname}:4243`;
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
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


  useEffect(() => {
    if (open) {
      const conn = getConnection();
      if (conn) {
        setServerUrl(conn.serverUrl);
        setApiKey(conn.apiKey);
      }
      setTestResult(null);
      if (!isGate) setTab("general");
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
    setServerUrl(defaultServerUrl);
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
    { id: "general", label: "General" },
    { id: "connection", label: "Connection" },
    { id: "comms", label: "Comms" },
    { id: "packages", label: "Integrations" },
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

          {/* General tab */}
          {!isGate && tab === "general" && (
            <>
              <h3 className="settings-section-title">Theme</h3>
              <div className="atmosphere-bar">
                <button
                  className={`atmosphere-btn${!selectedTheme ? " active" : ""}`}
                  onClick={() => onThemeChange(null)}
                >
                  <span className="atmosphere-dot" style={{ background: "#a8c4e0" }} />
                  Default
                </button>
                {(themes || []).map((t) => (
                  <button
                    key={t.id}
                    className={`atmosphere-btn${selectedTheme === t.id ? " active" : ""}`}
                    onClick={() => onThemeChange(t.id)}
                  >
                    <span className="atmosphere-dot" style={{ background: t.dot }} />
                    {t.label}
                  </button>
                ))}
              </div>

              <h3 className="settings-section-title">Navigation</h3>
              <label className="settings-toggle-row">
                <span>Show Backstage</span>
                <button
                  type="button"
                  className={`settings-toggle ${showBackstage ? "on" : ""}`}
                  onClick={() => onShowBackstageChange(!showBackstage)}
                  aria-label="Toggle Backstage visibility"
                >
                  <span className="settings-toggle-knob" />
                </button>
              </label>
              <p className="settings-toggle-desc">Displays the Backstage tab with routines, communications, and other information sources. Also enables permission request toasts.</p>
            </>
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

          {/* Integrations tab */}
          {!isGate && tab === "packages" && (
            <>
              <h3 className="settings-section-title">Integrations</h3>
              {packagesLoading && packages.length === 0 ? (
                <p className="settings-loading">Loading...</p>
              ) : packages.length === 0 ? (
                <p className="settings-loading">No integrations available</p>
              ) : (
                packages.map((pkg) => (
                  <PackageRow key={pkg.name} pkg={pkg} onReload={loadPackages} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
