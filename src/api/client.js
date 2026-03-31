import { getConnection, getHumanUser } from "../lib/connection.js";

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

export function getFastFathomUrl() {
  const conn = getConnection();
  if (!conn) return null;
  return `${conn.serverUrl}/fast-fathom`;
}

export function getThemes() {
  return request("/api/themes");
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

export function updateFeedStatus(itemId, status) {
  return request(`/api/feed/${encodeURIComponent(itemId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function getRoutines() {
  return request("/api/routines");
}

export function fireRoutine(id) {
  return request(`/api/routines/${encodeURIComponent(id)}/fire`);
}


export function sendMessage(text, workspace = null) {
  const ws = workspace || getWorkspace();
  return request(`/api/conversation/${ws}/send`, {
    method: "POST",
    body: JSON.stringify({ message: text }),
  });
}

export function uploadAttachment(file, message = "", workspace = null) {
  const conn = getConnection();
  if (!conn) throw new Error("Not connected");
  const ws = workspace || getWorkspace();
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

export function sendVoice(text, duration = 0, workspace = null) {
  const ws = workspace || getWorkspace();
  return request("/api/voice/send", {
    method: "POST",
    body: JSON.stringify({ text, workspace: ws, duration }),
  });
}

export function getConversation() {
  const ws = getWorkspace();
  return request(`/api/conversation/${ws}`);
}

export function getWorkspaceProfiles() {
  return request("/api/workspaces/profiles");
}

export function getBrowserSessions() {
  return request("/api/browser/sessions").catch(() => ({ sessions: [] }));
}

export function postToRoom(roomName, message, sender = null) {
  sender = sender || getHumanUser();
  return request(`/api/room/${encodeURIComponent(roomName)}`, {
    method: "POST",
    body: JSON.stringify({ message, sender }),
  });
}

export function readRoom(roomName, minutes = 60, workspace = null, markRead = false) {
  let url = `/api/room/${encodeURIComponent(roomName)}?minutes=${minutes}`;
  if (workspace) url += `&workspace=${encodeURIComponent(workspace)}`;
  if (markRead) url += `&mark_read=true`;
  return request(url);
}

export function getDmRoomName() {
  const ws = getWorkspace().toLowerCase();
  const human = getHumanUser().toLowerCase();
  const sorted = [ws, human].sort();
  return `dm:${sorted.join("+")}`;
}

export function sendDm(message) {
  return postToRoom(getDmRoomName(), message, getHumanUser());
}

export function pollDmRoom(minutes = 5) {
  const human = getHumanUser();
  return readRoom(getDmRoomName(), minutes, human, true);
}

export function getDmUnreadCount() {
  const human = getHumanUser();
  const dmRoom = getDmRoomName();
  return listRooms(human).then((data) => {
    const rooms = data.rooms || [];
    const dm = rooms.find((r) => r.name === dmRoom);
    return dm?.unread_count || 0;
  });
}

export function listRooms(workspace = "*") {
  return request(`/api/room/list?workspace=${encodeURIComponent(workspace)}`);
}

export function sendReaction(workspace, reaction, item) {
  const emoji = reaction === "up" ? "\u{1F44D}" : "\u{1F44E}";
  const verb = reaction === "up" ? "liked" : "disliked";
  const human = getHumanUser();
  const message = `${emoji} Human ${verb} your notification:\n\n**${item.title}**\n${item.body}`;
  const room = `dm:${[human, workspace].sort().join("+")}`;
  return request(`/api/room/${encodeURIComponent(room)}`, {
    method: "POST",
    body: JSON.stringify({ message, sender: human }),
  });
}

export function getVaultFiles(workspace, limit = 200) {
  return request(`/api/vault/files?workspace=${encodeURIComponent(workspace)}&limit=${limit}`);
}

export function getVaultFile(filePath, workspace) {
  return request(`/api/vault/file/${encodeURIComponent(filePath)}?workspace=${encodeURIComponent(workspace)}`);
}

export function searchVault(query, workspace) {
  return request(`/api/vault/search?q=${encodeURIComponent(query)}&workspace=${encodeURIComponent(workspace)}`);
}

export function vaultRawUrl(filePath, workspace) {
  const conn = getConnection();
  if (!conn) return "";
  return `${conn.serverUrl}/api/vault/raw/${encodeURIComponent(filePath)}?workspace=${encodeURIComponent(workspace)}&token=${conn.apiKey}`;
}

export function getPendingPermissions() {
  return request("/api/permissions/pending");
}

export function respondPermission(requestId, allow, reason = "") {
  return request(`/api/permissions/${requestId}/respond`, {
    method: "POST",
    body: JSON.stringify({ allow, reason }),
  });
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

export function provisionMementoKey() {
  return request("/api/packages/memento/provision", { method: "POST" });
}

export function saveMementoCredentials(key) {
  return request("/api/packages/memento/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
}

export function deleteMementoCredentials() {
  return request("/api/packages/memento/credentials", { method: "DELETE" });
}

export function submitOnboarding(name, interests) {
  const conn = getConnection();
  if (!conn) throw new Error("Not connected");
  return fetch(`${conn.serverUrl}/api/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, interests: [...interests] }),
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });
}

export function getOnboardingStatus() {
  const conn = getConnection();
  if (!conn) throw new Error("Not connected");
  return fetch(`${conn.serverUrl}/api/onboarding/status`).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
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
  const profiles = data.profiles || data;

  // Find the primary workspace from server config
  const workspaceNames = Object.keys(profiles);
  const primaryWorkspace = workspaceNames.includes("fathom") ? "fathom" : workspaceNames[0] || "fathom";

  // Find the human workspace for identity
  let humanUser = "user";
  let humanDisplayName = "User";
  for (const [key, val] of Object.entries(profiles)) {
    if (val && val.type === "human") {
      humanUser = key;
      humanDisplayName = val.display_name || key.charAt(0).toUpperCase() + key.slice(1);
      break;
    }
  }

  return { version: version.current, primaryWorkspace, humanUser, humanDisplayName };
}
