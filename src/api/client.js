const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function getFeed() {
  return request("/feed");
}

export function getRoutines() {
  return request("/routines");
}

export function fireRoutine(id) {
  return request(`/routines/${id}/fire`);
}

export function getChat() {
  return request("/chat");
}

export function sendChat(text) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function getWorkspaces() {
  return request("/workspaces");
}

export function getWeather() {
  return request("/weather");
}

export function getReceipt(id) {
  return request(`/receipts/${id}`);
}
