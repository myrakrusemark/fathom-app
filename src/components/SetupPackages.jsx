import { useState, useEffect, useRef, useCallback } from "react";
import {
  getPackages,
  installPackage,
  uninstallPackage,
  saveClaudeCredentials,
  deleteClaudeCredentials,
} from "../api/client.js";

export default function SetupPackages({ onComplete }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  // Claude auth state
  const [claudeAuthMode, setClaudeAuthMode] = useState(null);
  const [claudeCredential, setClaudeCredential] = useState("");
  const [claudeCredSaving, setClaudeCredSaving] = useState(false);
  const [claudeCredError, setClaudeCredError] = useState("");

  const loadPackages = useCallback(async () => {
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPackages();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadPackages]);

  function startPollingIfNeeded(pkgs) {
    if (pollRef.current) clearInterval(pollRef.current);
    if (pkgs.some((p) => p.status === "installing")) {
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

  const claude = packages.find((p) => p.name === "claude");
  const ready = claude?.status === "installed" && claude?.authenticated === true;

  return (
    <div className="settings-backdrop gate">
      <div className="settings-modal gate">
        <div className="settings-header">
          <h2 className="settings-title">Set Up Packages</h2>
        </div>
        <div className="settings-body">
          <p className="settings-gate-desc">
            Install and authenticate Claude Code to power your agent workspaces.
          </p>

          {loading && packages.length === 0 ? (
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
                        pkg.status === "installed" && pkg.authenticated === true
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

                {/* Claude auth — invalid credentials */}
                {pkg.name === "claude" && pkg.status === "installed" && pkg.authenticated === false && pkg.auth_error && !claudeAuthMode && (
                  <div className="settings-claude-auth invalid">
                    <span className="settings-claude-auth-label">
                      <span className="settings-claude-auth-error">{pkg.auth_error}</span>
                      {pkg.auth_method && (
                        <span className="settings-claude-auth-method">
                          via {pkg.auth_method === "api-key" ? "API key" : pkg.auth_method === "oauth-token" ? "OAuth token" : "credentials file"}
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
                          try { await deleteClaudeCredentials(); loadPackages(); } catch { /* silent */ }
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

          <div className="settings-actions" style={{ marginTop: "1.5rem" }}>
            <button
              className="settings-save-btn"
              onClick={onComplete}
              disabled={!ready}
            >
              Continue
            </button>
          </div>
          {!ready && claude?.status === "installed" && (
            <p style={{ textAlign: "center", fontSize: "0.85rem", opacity: 0.6, marginTop: "0.5rem" }}>
              Authenticate Claude Code to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
