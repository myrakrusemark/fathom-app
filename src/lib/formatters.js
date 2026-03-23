import { getConnection } from "./connection.js";

/**
 * Shared formatting utilities.
 *
 * timeAgo handles both ISO timestamp strings and Unix epoch seconds.
 * Pass { short: true } for compact format ("5m" vs "5m ago").
 */
export function timeAgo(timestamp, { short = false } = {}) {
  if (!timestamp) return "";
  // Unix seconds (before year 2001 in ms) → convert to ms
  let ms = typeof timestamp === "number" && timestamp < 1e12
    ? timestamp * 1000
    : new Date(timestamp).getTime();
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return short ? "now" : "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return short ? "now" : "just now";
  if (minutes < 60) return short ? `${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return short ? `${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return short ? `${days}d` : `${days}d ago`;
}

/** Time remaining until a future timestamp. Returns "" if timestamp is null. */
export function timeUntil(timestamp) {
  if (!timestamp) return "";
  const diff = new Date(timestamp).getTime() - Date.now();
  if (diff < 0) return "overdue";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  return `in ${Math.floor(minutes / 60)}h`;
}

/** Full date+time label, e.g. "Mar 5, 2:30 PM". */
export function formatTimestamp(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** Turn a slug like "my-workspace" into "My Workspace". */
export function prettyName(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip @workspace prefix and trailing context block from outbound chat text. */
export function stripChatDecorations(text) {
  let cleaned = text.replace(/^@\S+\s/, "");
  cleaned = cleaned.replace(/\n\n\(Context: reply to notification .+\)$/, "");
  return cleaned;
}

/**
 * Append ?token= (or &token=) auth param to a server-relative URL.
 * Safe to use in img src, audio src, and download href attributes.
 * Falls back to the original URL if not connected.
 */
export function authUrl(url) {
  const conn = getConnection();
  if (!conn) return url;
  const sep = url.includes("?") ? "&" : "?";
  return conn.serverUrl + url + sep + "token=" + conn.apiKey;
}
