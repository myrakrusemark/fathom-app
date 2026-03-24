import { useState } from "react";
import {
  installPackage,
  uninstallPackage,
  provisionMementoKey,
  saveMementoCredentials,
  deleteMementoCredentials,
} from "../api/client.js";

const PKG_DESCRIPTIONS = {
  claude: "Your workspaces can't run without this. Configure credentials in docker-compose.yml to authenticate.",
  memento: null, // handled inline with logo
  tts: "One tap to install. Gives your agent a voice for replies, notifications, and podcasts.",
  browser: "Playwright + virtual desktop. Gives agents isolated browser sessions you can monitor via VNC.",
};

export default function PackageRow({ pkg, onReload, showLogo = false }) {
  // Memento provisioning state
  const [mementoProvKey, setMementoProvKey] = useState(null);
  const [mementoProvisioning, setMementoProvisioning] = useState(false);
  const [mementoProvError, setMementoProvError] = useState("");

  // Memento manual key entry (settings modal mode)
  const [mementoManualKey, setMementoManualKey] = useState("");
  const [mementoSaving, setMementoSaving] = useState(false);
  const [mementoError, setMementoError] = useState("");

  // Claude info expand state
  const [claudeInfoOpen, setClaudeInfoOpen] = useState(false);

  // Install/uninstall error
  const [pkgError, setPkgError] = useState("");

  async function handleInstall() {
    setPkgError("");
    try { await installPackage(pkg.name); onReload(); } catch (err) { setPkgError(err.message || "Install failed"); }
  }

  async function handleUninstall() {
    setPkgError("");
    try { await uninstallPackage(pkg.name); onReload(); } catch (err) { setPkgError(err.message || "Uninstall failed"); }
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
          ) : pkg.status === "installed" ? (
            <button className="settings-pkg-btn uninstall" onClick={handleUninstall}>Uninstall</button>
          ) : pkg.status === "installing" ? (
            <span className="settings-pkg-status">Installing...</span>
          ) : (
            <button className="settings-pkg-btn install" onClick={handleInstall}>Install</button>
          )}
        </div>
      </div>

      {pkgError && <p className="settings-claude-auth-error">{pkgError}</p>}

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

      {/* Claude auth — authenticated */}
      {pkg.name === "claude" && pkg.status === "installed" && pkg.authenticated === true && (
        <div className="settings-claude-auth authenticated">
          <span className="settings-claude-auth-label">
            Authenticated
            <span className="settings-claude-auth-method">
              via {pkg.auth_method === "api-key" ? "API key" : pkg.auth_method === "credentials-file" ? "credentials file" : "OAuth token"}
            </span>
          </span>
          <span className="settings-claude-auth-actions">
            <button onClick={() => setClaudeInfoOpen(o => !o)}>
              {claudeInfoOpen ? "Less" : "More info"}
            </button>
          </span>
        </div>
      )}

      {/* Claude auth — not authenticated */}
      {pkg.name === "claude" && pkg.status === "installed" && pkg.authenticated === false && (
        <div className="settings-claude-auth unauthenticated">
          {pkg.auth_error && <p className="settings-claude-auth-warning">{pkg.auth_error}</p>}
          <button
            className="settings-claude-auth-back"
            style={{ marginBottom: "0.25rem" }}
            onClick={() => setClaudeInfoOpen(o => !o)}
          >
            {claudeInfoOpen ? "▲ Hide" : "▼ How to configure"}
          </button>
        </div>
      )}

      {/* Claude auth — expanded info (shown in both states) */}
      {pkg.name === "claude" && pkg.status === "installed" && claudeInfoOpen && (
        <div style={{ fontSize: "0.85rem", padding: "0.5rem 0 0.25rem" }}>
          <p style={{ margin: "0 0 0.4rem", opacity: 0.7 }}>
            Configure one of the following in your <code style={{ cursor: "auto" }}>docker-compose.yml</code> and restart the container. The first one found is used.
          </p>
          <ol style={{ margin: "0 0 0 1rem", paddingLeft: "0.5rem", lineHeight: 1.9, opacity: 0.6 }}>
            <li>
              <strong>Credentials file</strong> — bind-mount your host login session (auto-refreshed when you run <code style={{ cursor: "auto" }}>claude login</code>):<br />
              <code
                style={{ cursor: "pointer", display: "inline-block", marginTop: "0.2rem" }}
                onClick={(e) => navigator.clipboard.writeText(e.target.textContent)}
                title="Click to copy"
              >~/.claude/.credentials.json:/data/claude/.credentials.json:ro</code>
            </li>
            <li>
              <strong>CLAUDE_CODE_OAUTH_TOKEN</strong> — OAuth token as an environment variable
            </li>
            <li>
              <strong>ANTHROPIC_API_KEY</strong> — API key as an environment variable
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
