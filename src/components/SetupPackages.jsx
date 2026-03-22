import { useState, useEffect, useRef, useCallback } from "react";
import { getPackages } from "../api/client.js";
import PackageRow from "./PackageRow.jsx";

export default function SetupPackages({ onComplete }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

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
            Your agent workspaces need a few integrations to reach full capability.
          </p>

          {loading && packages.length === 0 ? (
            <p className="settings-loading">Loading...</p>
          ) : packages.length === 0 ? (
            <p className="settings-loading">No packages available</p>
          ) : (
            packages.map((pkg) => (
              <PackageRow key={pkg.name} pkg={pkg} onReload={loadPackages} showLogo={true} />
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
