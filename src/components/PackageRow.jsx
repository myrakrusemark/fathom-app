import { useState } from "react";
import {
  installPackage,
  uninstallPackage,
  provisionMementoKey,
  saveClaudeCredentials,
  deleteClaudeCredentials,
  saveMementoCredentials,
  deleteMementoCredentials,
  connectBrowserless,
  disconnectBrowserless,
} from "../api/client.js";

const PKG_DESCRIPTIONS = {
  claude: "Your workspaces can't run without this. Install it, then authenticate to connect your credentials.",
  memento: null, // handled inline with logo
  tts: "One tap to install. Gives your agent a voice for replies, notifications, and podcasts.",
  browserless: "Headless Chrome for web browsing. Set browser: true in workspaces.json to enable per-workspace.",
};

export default function PackageRow({ pkg, onReload, showLogo = false }) {
  // Claude auth state
  const [claudeAuthMode, setClaudeAuthMode] = useState(null);
  const [claudeCredential, setClaudeCredential] = useState("");
  const [claudeCredSaving, setClaudeCredSaving] = useState(false);
  const [claudeCredError, setClaudeCredError] = useState("");

  // Memento provisioning state
  const [mementoProvKey, setMementoProvKey] = useState(null);
  const [mementoProvisioning, setMementoProvisioning] = useState(false);
  const [mementoProvError, setMementoProvError] = useState("");

  // Memento manual key entry (settings modal mode)
  const [mementoManualKey, setMementoManualKey] = useState("");
  const [mementoSaving, setMementoSaving] = useState(false);
  const [mementoError, setMementoError] = useState("");

  // Browserless connection state
  const [blEndpoint, setBlEndpoint] = useState("");
  const [blConnecting, setBlConnecting] = useState(false);
  const [blError, setBlError] = useState("");

  async function handleInstall() {
    try { await installPackage(pkg.name); onReload(); } catch { /* silent */ }
  }

  async function handleUninstall() {
    try { await uninstallPackage(pkg.name); onReload(); } catch { /* silent */ }
  }

  const desc = PKG_DESCRIPTIONS[pkg.name];

  return (
    <div className="settings-pkg-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      {/* Header row: name/logo + status/action */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="settings-pkg-info">
          <span
            className={`settings-pkg-dot ${
              pkg.status === "installed" && (pkg.authenticated === true || pkg.authenticated === undefined)
                ? "installed"
                : pkg.status === "installed" && pkg.auth_error
                  ? "error"
                  : pkg.status === "installed" && pkg.authenticated === false
                    ? "warning"
                    : pkg.status === "installing"
                      ? "installing"
                      : ""
            }`}
          />
          <div>
            {pkg.preinstalled && showLogo ? (
              <img src="/memento-logo.png" alt="memento-mcp" style={{ height: "2.8em", verticalAlign: "middle" }} />
            ) : (
              <span className="settings-pkg-name">{pkg.label || pkg.name}</span>
            )}
            {pkg.status === "installing" && pkg.progress && (
              <span className="settings-pkg-progress">{pkg.progress}</span>
            )}
          </div>
        </div>
        <div className="settings-pkg-actions">
          {pkg.preinstalled ? (
            pkg.authenticated ? (
              <span className="settings-pkg-status" style={{ color: "var(--accent, #6c63ff)" }}>configured</span>
            ) : (
              <span className="settings-pkg-status" style={{ color: "var(--text-secondary, #888)" }}>not configured</span>
            )
          ) : pkg.external ? (
            pkg.status === "installed" ? (
              <span className="settings-pkg-status" style={{ color: "var(--accent, #6c63ff)" }}>connected</span>
            ) : pkg.ws_endpoint ? (
              <span className="settings-pkg-status" style={{ color: "var(--error, #e53e3e)" }}>not reachable</span>
            ) : (
              <span className="settings-pkg-status" style={{ color: "var(--text-secondary, #888)" }}>not connected</span>
            )
          ) : pkg.status === "installed" ? (
            <button className="settings-pkg-btn uninstall" onClick={handleUninstall}>Uninstall</button>
          ) : pkg.status === "installing" ? (
            <span className="settings-pkg-status">Installing...</span>
          ) : (
            <button className="settings-pkg-btn install" onClick={handleInstall}>Install</button>
          )}
        </div>
      </div>

      {/* Package description */}
      {desc && (
        <p style={{ fontSize: "0.85rem", opacity: 0.6, margin: "0.25rem 0" }}>{desc}</p>
      )}

      {/* Memento — description + provisioning + manual key */}
      {pkg.name === "memento" && (
        <div style={{ fontSize: "0.85rem", padding: "0.25rem 0" }}>
          <p style={{ margin: "0.25rem 0", opacity: 0.6 }}>
            Your agents develop identity, perspective, taste, and wisdom — not just recall.<br />
            <a href="https://hifathom.com/memento" target="_blank" rel="noopener noreferrer" style={{ opacity: 1 }}>
              Learn more
            </a>
          </p>

          {/* Authenticated */}
          {pkg.authenticated === true && (
            <div className="settings-claude-auth authenticated">
              <span className="settings-claude-auth-label">Configured</span>
              <span className="settings-claude-auth-actions">
                <button
                  className="danger"
                  onClick={async () => {
                    if (!confirm("Remove Memento API key?")) return;
                    try { await deleteMementoCredentials(); onReload(); } catch { /* silent */ }
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
          )}

          {/* Not authenticated — provision or enter key */}
          {pkg.authenticated !== true && !mementoProvKey && (
            <div style={{ marginTop: "0.5rem" }}>
              <button
                className="settings-claude-auth-opt"
                disabled={mementoProvisioning}
                onClick={async () => {
                  setMementoProvisioning(true);
                  setMementoProvError("");
                  try {
                    const data = await provisionMementoKey();
                    if (data.error || data.message) { setMementoProvError(data.error || data.message); return; }
                    setMementoProvKey(data.api_key);
                  } catch {
                    setMementoProvError("Could not reach Memento API");
                  } finally {
                    setMementoProvisioning(false);
                  }
                }}
              >
                <span>{mementoProvisioning ? "Provisioning..." : "Get a free API key"}</span>
              </button>
              {mementoProvError && <p style={{ color: "var(--error, #e53e3e)", margin: "0.25rem 0" }}>{mementoProvError}</p>}

              {/* Manual key entry */}
              <div className="settings-claude-auth-form" style={{ marginTop: "0.5rem" }}>
                <input
                  type="password"
                  placeholder="Or paste an existing key..."
                  value={mementoManualKey}
                  onChange={(e) => { setMementoManualKey(e.target.value); setMementoError(""); }}
                />
                <button
                  disabled={!mementoManualKey || mementoSaving}
                  onClick={async () => {
                    setMementoSaving(true);
                    setMementoError("");
                    try {
                      const res = await saveMementoCredentials(mementoManualKey);
                      if (res.error) { setMementoError(res.error); return; }
                      setMementoManualKey("");
                      onReload();
                    } catch {
                      setMementoError("Failed to save");
                    } finally {
                      setMementoSaving(false);
                    }
                  }}
                >
                  {mementoSaving ? "..." : "Save"}
                </button>
              </div>
              {mementoError && <p className="settings-claude-auth-error">{mementoError}</p>}
            </div>
          )}

          {/* Provisioned key display */}
          {mementoProvKey && (
            <div style={{
              marginTop: "0.5rem",
              background: "rgba(0, 180, 180, 0.06)",
              borderRadius: "8px",
              padding: "0.75rem",
              border: "1px solid rgba(0, 180, 180, 0.15)",
            }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", opacity: 0.7 }}>
                Set as <code style={{ background: "rgba(0,0,0,0.05)", padding: "1px 4px", borderRadius: "3px" }}>MEMENTO_API_KEY</code> in your <code style={{ background: "rgba(0,0,0,0.05)", padding: "1px 4px", borderRadius: "3px" }}>.env</code>
              </p>
              <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                <input
                  type="text"
                  value={mementoProvKey}
                  readOnly
                  onClick={(e) => e.target.select()}
                  style={{
                    fontFamily: "monospace", fontSize: "0.8rem", flex: 1,
                    padding: "0.4rem 0.6rem", borderRadius: "6px",
                    border: "1px solid rgba(0, 180, 180, 0.25)",
                    background: "rgba(255,255,255,0.7)", color: "#1a1a2e", outline: "none",
                  }}
                />
                <button
                  style={{
                    padding: "0.4rem 0.75rem", borderRadius: "6px",
                    border: "1px solid rgba(0, 180, 180, 0.3)",
                    background: "rgba(0, 180, 180, 0.1)", color: "rgb(0, 150, 150)",
                    cursor: "pointer", fontSize: "0.8rem", fontWeight: 500,
                  }}
                  onClick={(e) => {
                    navigator.clipboard.writeText(mementoProvKey);
                    const btn = e.target;
                    btn.textContent = "Copied!";
                    setTimeout(() => { btn.textContent = "Copy"; }, 1500);
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Browserless — connected */}
      {pkg.name === "browserless" && pkg.status === "installed" && (
        <div className="settings-claude-auth authenticated">
          <span className="settings-claude-auth-label">
            Connected
            <span className="settings-claude-auth-method">
              at {pkg.ws_endpoint}
            </span>
          </span>
          <span className="settings-claude-auth-actions">
            <button
              className="danger"
              onClick={async () => {
                if (!confirm("Disconnect Browserless?")) return;
                try { await disconnectBrowserless(); onReload(); } catch { /* silent */ }
              }}
            >
              Disconnect
            </button>
          </span>
        </div>
      )}

      {/* Browserless — not connected */}
      {pkg.name === "browserless" && pkg.status !== "installed" && (
        <div className="settings-claude-auth unauthenticated">
          <p className="settings-claude-auth-help" style={{ margin: "0.25rem 0 0.5rem" }}>
            Add the browserless service to your <code style={{ cursor: "auto" }}>docker-compose.yml</code>:
          </p>
          <pre style={{
            fontSize: "0.75rem", background: "rgba(0,0,0,0.04)", borderRadius: "6px",
            padding: "0.5rem 0.75rem", margin: "0 0 0.5rem", overflowX: "auto",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>{`browserless:
  image: ghcr.io/browserless/chromium
  restart: unless-stopped
  ports:
    - "3000:3000"
  environment:
    - TIMEOUT=300000
    - CONCURRENT=5
    - HEALTH=true`}</pre>
          <div className="settings-claude-auth-form">
            <input
              type="text"
              placeholder="ws://browserless:3000"
              value={blEndpoint}
              onChange={(e) => { setBlEndpoint(e.target.value); setBlError(""); }}
            />
            <button
              disabled={!blEndpoint || blConnecting}
              onClick={async () => {
                setBlConnecting(true);
                setBlError("");
                try {
                  const res = await connectBrowserless(blEndpoint);
                  if (res.error) { setBlError(res.error); return; }
                  if (!res.connected) { setBlError("Endpoint not reachable"); return; }
                  setBlEndpoint("");
                  onReload();
                } catch {
                  setBlError("Failed to connect");
                } finally {
                  setBlConnecting(false);
                }
              }}
            >
              {blConnecting ? "..." : "Connect"}
            </button>
          </div>
          {blError && <p className="settings-claude-auth-error">{blError}</p>}
        </div>
      )}

      {/* Claude auth — authenticated */}
      {pkg.name === "claude" && pkg.status === "installed" && pkg.authenticated === true && !claudeAuthMode && (
        <div className="settings-claude-auth authenticated">
          <span className="settings-claude-auth-label">
            Authenticated
            <span className="settings-claude-auth-method">
              via {pkg.auth_method === "api-key" ? "API key" : pkg.auth_method === "credentials-file" ? "credentials file" : "OAuth token"}
            </span>
          </span>
          <span className="settings-claude-auth-actions">
            <button onClick={() => setClaudeAuthMode("change")}>Change</button>
            <span className="sep">|</span>
            <button
              className="danger"
              onClick={async () => {
                if (!confirm("Remove Claude Code credentials?")) return;
                try { await deleteClaudeCredentials(); onReload(); } catch { /* silent */ }
              }}
            >
              Remove
            </button>
          </span>
        </div>
      )}

      {/* Claude auth — invalid credentials */}
      {pkg.name === "claude" && pkg.status === "installed" && pkg.authenticated === false && pkg.auth_error && !claudeAuthMode && (
        <div className="settings-claude-auth invalid">
          <span className="settings-claude-auth-label">
            <span className="settings-claude-auth-error">{pkg.auth_error}</span>
            {pkg.auth_method && (
              <span className="settings-claude-auth-method">
                via {pkg.auth_method === "api-key" ? "API key" : pkg.auth_method === "credentials-file" ? "credentials file" : "OAuth token"}
              </span>
            )}
          </span>
          <span className="settings-claude-auth-actions">
            <button onClick={() => setClaudeAuthMode("change")}>Change</button>
            <span className="sep">|</span>
            <button
              className="danger"
              onClick={async () => {
                if (!confirm("Remove Claude Code credentials?")) return;
                try { await deleteClaudeCredentials(); onReload(); } catch { /* silent */ }
              }}
            >
              Remove
            </button>
          </span>
        </div>
      )}

      {/* Claude auth — not authenticated or changing */}
      {pkg.name === "claude" && pkg.status === "installed" && ((pkg.authenticated === false && !pkg.auth_error) || claudeAuthMode === "change") && (
        <div className="settings-claude-auth unauthenticated">
          {pkg.authenticated === false && !pkg.auth_error && <p className="settings-claude-auth-warning">Not authenticated</p>}
          {claudeAuthMode === "change" && <p className="settings-claude-auth-warning" style={{ color: "var(--text-secondary)" }}>Change credentials</p>}

          {(!claudeAuthMode || claudeAuthMode === "change") && (
            <div className="settings-claude-auth-options">
              <button className="settings-claude-auth-opt" onClick={() => setClaudeAuthMode("credentials-file")}>
                <span>Credentials file</span>
                <span className="hint">auto-refreshed via Claude Code login</span>
              </button>
              <button className="settings-claude-auth-opt" onClick={() => setClaudeAuthMode("api-key")}>
                <span>API key</span>
                <span className="hint">pay-per-token billing</span>
              </button>
            </div>
          )}

          {claudeAuthMode && claudeAuthMode !== "change" && (
            <div className="settings-claude-auth-input">
              {claudeAuthMode === "credentials-file" && (
                <p className="settings-claude-auth-help">
                  Add this bind-mount to your <code style={{ cursor: "auto" }}>docker-compose.yml</code> volumes:
                  <code
                    onClick={(e) => { navigator.clipboard.writeText(e.target.textContent); }}
                  >~/.claude/.credentials.json:/data/claude/.credentials.json:ro</code>
                  Then restart the container. The token refreshes automatically when you run <code style={{ cursor: "auto" }}>claude login</code> on the host.
                </p>
              )}
              {claudeAuthMode === "api-key" && (<>
              <div className="settings-claude-auth-form">
                <input
                  type="password"
                  placeholder="sk-ant-..."
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
                      onReload();
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
              </>)}
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
  );
}
