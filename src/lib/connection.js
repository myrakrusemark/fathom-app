const STORAGE_KEY = "fathom_connection";

export function getConnection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const conn = JSON.parse(raw);
    if (!conn.serverUrl || !conn.apiKey) return null;
    return conn;
  } catch {
    return null;
  }
}

export function saveConnection({ serverUrl, apiKey, primaryWorkspace }) {
  const cleaned = serverUrl.replace(/\/+$/, "");
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ serverUrl: cleaned, apiKey, primaryWorkspace: primaryWorkspace || "fathom" }),
  );
}

export function clearConnection() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isConnected() {
  const conn = getConnection();
  return !!(conn && conn.serverUrl && conn.apiKey);
}
