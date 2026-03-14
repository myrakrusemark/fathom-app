import { useState, useEffect, useRef } from "react";
import { getConnection, saveConnection, clearConnection } from "../lib/connection.js";
import { testConnection } from "../api/client.js";

export default function SettingsModal({ open, onClose, onConnectionChange, isGate }) {
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message, data }
  const backdropRef = useRef(null);

  useEffect(() => {
    if (open) {
      const conn = getConnection();
      if (conn) {
        setServerUrl(conn.serverUrl);
        setApiKey(conn.apiKey);
      }
      setTestResult(null);
    }
  }, [open]);

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
    // Primary workspace comes from the server via test connection, defaults to "fathom"
    const primaryWorkspace = testResult?.data?.primary_workspace || "fathom";
    saveConnection({
      serverUrl: serverUrl.trim(),
      apiKey: apiKey.trim(),
      primaryWorkspace,
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

        <div className="settings-body">
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
        </div>
      </div>
    </div>
  );
}
