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

export function getWeather() {
  return request("/api/weather");
}

export function getReceipt(id) {
  return request(`/api/receipts/${id}`);
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
