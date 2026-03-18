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

export function saveConnection({ serverUrl, apiKey, primaryWorkspace, humanUser, humanDisplayName }) {
  const cleaned = serverUrl.replace(/\/+$/, "");
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      serverUrl: cleaned,
      apiKey,
      primaryWorkspace: primaryWorkspace || "fathom",
      humanUser: humanUser || "user",
      humanDisplayName: humanDisplayName || "User",
    }),
  );
}

export function getHumanUser() {
  const conn = getConnection();
  return conn?.humanUser || "user";
}

export function getHumanDisplayName() {
  const conn = getConnection();
  return conn?.humanDisplayName || "User";
}

export function clearConnection() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isConnected() {
  const conn = getConnection();
  return !!(conn && conn.serverUrl && conn.apiKey);
}
