import { getConnection } from "../lib/connection.js";

function request(path, options = {}) {
  const conn = getConnection();
  if (!conn) throw new Error("Not connected");
  const headers = { "Content-Type": "application/json", ...options.headers };
  headers["Authorization"] = `Bearer ${conn.apiKey}`;
  return fetch(`${conn.serverUrl}${path}`, { ...options, headers }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });
}

export function getWsUrl(path) {
  const conn = getConnection();
  if (!conn) return null;
  const wsBase = conn.serverUrl.replace(/^http/, "ws");
  return `${wsBase}${path}?token=${conn.apiKey}`;
}

export function getWorkspace() {
  const conn = getConnection();
  return conn?.primaryWorkspace || "fathom";
}

export function getFeed() {
  return request("/api/feed");
}

export function dismissFeedItem(itemId) {
  return request(`/api/feed/dismiss/${encodeURIComponent(itemId)}`, { method: "POST" });
}

export function restoreFeedItem(itemId) {
  return request(`/api/feed/dismiss/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

export function getRoutines() {
  return request("/api/routines");
}

export function fireRoutine(id) {
  return request(`/api/routines/${id}/fire`);
}

export function getChat() {
  return request("/api/chat");
}

export function sendMessage(text) {
  const ws = getWorkspace();
  return request(`/api/conversation/${ws}/send`, {
    method: "POST",
    body: JSON.stringify({ message: text }),
  });
}

export function uploadAttachment(file, message = "") {
  const conn = getConnection();
  if (!conn) throw new Error("Not connected");
  const ws = getWorkspace();
  const form = new FormData();
  form.append("file", file);
  if (message) form.append("message", message);
  return fetch(`${conn.serverUrl}/api/conversation/${ws}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.apiKey}` },
    body: form,
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });
}

export function sendVoice(text, duration = 0) {
  const ws = getWorkspace();
  return request("/api/voice/send", {
    method: "POST",
    body: JSON.stringify({ text, workspace: ws, duration }),
  });
}

export function getConversation() {
  const ws = getWorkspace();
  return request(`/api/conversation/${ws}`);
}

export function getWorkspaces() {
  return request("/api/workspaces");
}

export function getWorkspaceProfiles() {
  return request("/api/workspaces/profiles");
}

export function getWeather() {
  return request("/api/weather");
}

export function getReceipt(id) {
  return request(`/api/receipts/${id}`);
}

export function postToRoom(roomName, message, sender = "myra") {
  return request(`/api/room/${encodeURIComponent(roomName)}`, {
    method: "POST",
    body: JSON.stringify({ message, sender }),
  });
}

export function readRoom(roomName, minutes = 60, workspace = null) {
  let url = `/api/room/${encodeURIComponent(roomName)}?minutes=${minutes}`;
  if (workspace) url += `&workspace=${encodeURIComponent(workspace)}`;
  return request(url);
}

export function listRooms(workspace = "*") {
  return request(`/api/room/list?workspace=${encodeURIComponent(workspace)}`);
}

export function sendReaction(workspace, reaction, item) {
  const emoji = reaction === "up" ? "\u{1F44D}" : "\u{1F44E}";
  const verb = reaction === "up" ? "liked" : "disliked";
  const message = `${emoji} Human ${verb} your notification:\n\n**${item.title}**\n${item.body}`;
  const room = `dm:${["myra", workspace].sort().join("+")}`;
  return request(`/api/room/${encodeURIComponent(room)}`, {
    method: "POST",
    body: JSON.stringify({ message, sender: "myra" }),
  });
}

export function getSuggestions() {
  return request("/api/suggestions");
}

export function getVaultFiles(workspace, limit = 200) {
  return request(`/api/vault/files?workspace=${encodeURIComponent(workspace)}&limit=${limit}`);
}

export function getVaultFile(filePath, workspace) {
  return request(`/api/vault/file/${filePath}?workspace=${encodeURIComponent(workspace)}`);
}

export function searchVault(query, workspace) {
  return request(`/api/vault/search?q=${encodeURIComponent(query)}&workspace=${encodeURIComponent(workspace)}`);
}

export function vaultRawUrl(filePath, workspace) {
  const conn = getConnection();
  if (!conn) return "";
  return `${conn.serverUrl}/api/vault/raw/${filePath}?workspace=${encodeURIComponent(workspace)}&token=${conn.apiKey}`;
}

export function getSettings() {
  return request("/api/settings");
}

export function updateSettings(body) {
  return request("/api/settings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getPackages() {
  return request("/api/packages");
}

export function installPackage(name) {
  return request(`/api/packages/${encodeURIComponent(name)}/install`, { method: "POST" });
}

export function uninstallPackage(name) {
  return request(`/api/packages/${encodeURIComponent(name)}/uninstall`, { method: "POST" });
}

export async function testConnection(serverUrl, apiKey) {
  const cleaned = serverUrl.replace(/\/+$/, "");

  // First: check reachability (no auth required)
  const versionRes = await fetch(`${cleaned}/api/version`);
  if (!versionRes.ok) throw new Error(`Server unreachable (${versionRes.status})`);
  const version = await versionRes.json();

  // Second: validate key against an authenticated endpoint
  const authRes = await fetch(`${cleaned}/api/workspaces/profiles`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (authRes.status === 401) throw new Error("Invalid API key");
  if (authRes.status === 403) throw new Error("Key lacks admin access");
  if (!authRes.ok) throw new Error(`Auth check failed (${authRes.status})`);

  const data = await authRes.json();

  // Find the primary workspace from server config
  const workspaceNames = Object.keys(data.profiles || data);
  const primaryWorkspace = workspaceNames.includes("fathom") ? "fathom" : workspaceNames[0] || "fathom";

  return { version: version.current, primaryWorkspace };
}
