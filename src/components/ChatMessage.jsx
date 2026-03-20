/* eslint-disable react-refresh/only-export-components */
import { useState, useRef } from "react";
import { getConnection } from "../lib/connection.js";
import ThoughtBubble from "./ThoughtBubble.jsx";

export function timeAgo(timestamp) {
  let ms = new Date(timestamp).getTime();
  // Detect Unix seconds (< year 2001 in ms) and convert
  if (ms < 1e12) ms = ms * 1000;
  const diff = Date.now() - ms;
  if (diff < 0 || !Number.isFinite(diff)) return "now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function renderMarkdown(text) {
  if (!text) return null;
  const parts = text.split("\n\n");
  return parts.map((block, i) => {
    const trimmed = block.trim();
    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed.split(/\n/).filter(Boolean);
      return (
        <ol key={i} className="chat-md-ol">
          {items.map((item, j) => (
            <li key={j}>{inlineMarkdown(item.replace(/^\d+\.\s*/, ""))}</li>
          ))}
        </ol>
      );
    }
    if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed.split(/\n/).filter(Boolean);
      return (
        <ul key={i} className="chat-md-ul">
          {items.map((item, j) => (
            <li key={j}>{inlineMarkdown(item.replace(/^[-*]\s*/, ""))}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{inlineMarkdown(trimmed)}</p>;
  });
}

function inlineMarkdown(text) {
  const tokens = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      tokens.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      tokens.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      tokens.push(<code key={match.index} className="chat-md-code">{match[4]}</code>);
    } else if (match[5] && match[6]) {
      tokens.push(
        <a key={match.index} href={match[6]} className="chat-md-link" onClick={(e) => e.stopPropagation()}>
          {match[5]}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}

export function formatSize(bytes) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeIcon(type) {
  switch (type) {
    case "image": return "\uD83D\uDDBC\uFE0F";
    case "audio": return "\uD83C\uDFB5";
    case "video": return "\uD83C\uDFAC";
    case "document": return "\uD83D\uDCC4";
    case "data": return "\uD83D\uDCCA";
    default: return "\uD83D\uDCC1";
  }
}

export function authUrl(url) {
  const conn = getConnection();
  if (!conn) return url;
  const sep = url.includes("?") ? "&" : "?";
  return conn.serverUrl + url + sep + "token=" + conn.apiKey;
}

const VOICE_BAR_HEIGHTS = [12, 8, 18, 6, 15, 10, 19, 7, 14, 11, 17, 9];

function VoiceMessage({ msg }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  function handlePlay() {
    if (!msg.audio_url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    const conn = getConnection();
    const baseUrl = conn?.serverUrl || "";
    const audio = new Audio(`${baseUrl}${msg.audio_url}`);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    audio.play();
    setPlaying(true);
  }

  return (
    <div
      className={`chat-voice ${msg.audio_url ? "playable" : ""} ${playing ? "playing" : ""}`}
      onClick={handlePlay}
    >
      {msg.audio_url ? (
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          {playing ? (
            <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>
          ) : (
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <path d="M12 19v4M8 23h8" />
        </svg>
      )}
      <div className="chat-voice-wave">
        {VOICE_BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className={`chat-voice-bar ${playing ? "animating" : ""}`}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <span className="chat-voice-dur">{msg.duration}s</span>
    </div>
  );
}

/** Extract a detail string from tool input parameters — no truncation. */
function toolDetail(name, input) {
  if (!input || !name) return null;
  // File operations — show the path
  if (name === "Read" || name === "Write" || name === "Edit") {
    return input.file_path || null;
  }
  // Search tools — show what was searched
  if (name === "Glob") return input.pattern || null;
  if (name === "Grep") return input.pattern || null;
  if (name === "ToolSearch") return input.query || null;
  // Bash — show command or description
  if (name === "Bash") return input.description || input.command || null;
  // Agent tool
  if (name === "Agent") return input.description || null;
  // Memento tools
  if (name.includes("memento_recall")) return input.query || null;
  if (name.includes("memento_remember")) return input.text || input.content || null;
  if (name.includes("memento_item_create") || name.includes("memento_item_update")) {
    return input.title || input.name || null;
  }
  if (name.includes("memento_item_list")) return input.category || null;
  if (name.includes("memento_skip_add")) return input.pattern || input.label || null;
  // Vault search
  if (name.includes("vault_search") || name.includes("vault_vsearch") || name.includes("vault_query")) {
    return input.query || null;
  }
  if (name.includes("vault_read")) return input.path || null;
  // Room tools
  if (name.includes("room_read")) return input.room ? `#${input.room}` : null;
  if (name.includes("room_post")) return input.room ? `#${input.room}` : null;
  if (name.includes("room_list")) return null;
  // Fathom send/speak
  if (name.includes("fathom_send")) return input.message || input.text || input.workspace || null;
  if (name.includes("fathom_speak")) return input.text || null;
  // Chrome tools
  if (name.includes("navigate_page")) return input.url?.replace(/^https?:\/\//, "") || null;
  if (name.includes("take_screenshot")) return null;
  if (name.includes("evaluate_script")) return null;
  if (name.includes("click") || name.includes("fill") || name.includes("type_text")) {
    return input.selector || input.text || null;
  }
  // Fal.ai
  if (name.includes("generate_image") || name.includes("edit_image")) return input.prompt || null;
  // Routine tools
  if (name.includes("routine_fire")) return input.routine_id || null;
  if (name.includes("routine_list")) return null;
  // Workspaces
  if (name.includes("fathom_workspaces")) return null;
  return null;
}

/** Clean up MCP tool names for display and pick an appropriate icon. */
function toolDisplay(name, input) {
  const detail = toolDetail(name, input);
  if (!name) return { label: "working", icon: "tool", detail };
  if (name.includes("memento_remember") || name.includes("memento_recall")) {
    return { label: "remembering", icon: "memory", detail };
  }
  if (name.includes("memento_consolidate")) {
    return { label: "consolidating memories", icon: "memory", detail };
  }
  if (name.includes("memento_item_create") || name.includes("memento_item_update")) {
    return { label: "updating memory", icon: "memory", detail };
  }
  if (name.includes("memento_")) {
    const short = name.replace(/^mcp__memento__/, "").replace(/^memento_/, "");
    return { label: short, icon: "memory", detail };
  }
  if (name.includes("telegram_send")) return { label: "sending message", icon: "tool", detail };
  if (name.includes("telegram_read")) return { label: "reading messages", icon: "tool", detail };
  if (name.includes("vault_search") || name.includes("vault_vsearch") || name.includes("vault_query")) {
    return { label: "searching vault", icon: "tool", detail };
  }
  const clean = name.replace(/^mcp__[^_]+__/, "");
  return { label: clean, icon: "tool", detail };
}

function ToolIndicator({ msg }) {
  const { label, icon, detail } = toolDisplay(msg.name, msg.input);
  return (
    <div className="chat-tool-line">
      <span className="chat-tool-icon">
        {icon === "memory" ? (
          <ThoughtBubble size={14} color="var(--text-muted)" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
          </svg>
        )}
      </span>
      <span className="chat-tool-name">{label}</span>
      {detail && <span className="chat-tool-detail">{detail}</span>}
      {msg.status === "running" && (
        <span className="chat-tool-status">
          <span className="chat-working-dot" />
          <span className="chat-working-dot" />
          <span className="chat-working-dot" />
        </span>
      )}
    </div>
  );
}

export function ToolGroup({ tools }) {
  return (
    <div className="chat-tool-group">
      {tools.map((msg) => (
        <ToolIndicator key={msg.id} msg={msg} />
      ))}
    </div>
  );
}

function PingEvent({ msg }) {
  const [expanded, setExpanded] = useState(false);
  // Extract first line as header (usually "[Ping — Time: ...]")
  const firstLine = (msg.text || "").split("\n")[0] || "routine fired";
  const rest = (msg.text || "").split("\n").slice(1).join("\n").trim();
  return (
    <div className="chat-ping-event" onClick={() => setExpanded(!expanded)}>
      <div className="chat-ping-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="chat-ping-label">ping</span>
        <span className="chat-ping-title">{firstLine.replace(/^\[|\]$/g, "")}</span>
        {rest && (
          <svg className="chat-ping-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>
      {expanded && rest && (
        <pre className="chat-ping-body">{rest}</pre>
      )}
    </div>
  );
}

export default function ChatMessage({ msg }) {
  const isUser = msg.role === "user";

  if (msg.type === "presence") {
    return (
      <div className="chat-presence">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        {msg.label && <span className="chat-presence-label">{msg.label}</span>}
      </div>
    );
  }

  if (msg.type === "ping") {
    return <PingEvent msg={msg} />;
  }

  if (msg.type === "meta") {
    return (
      <div className="chat-meta-event">
        <span>{msg.label}</span>
      </div>
    );
  }

  if (msg.type === "working") {
    return (
      <div className="chat-working">
        <span className="chat-working-dot" />
        <span className="chat-working-dot" />
        <span className="chat-working-dot" />
      </div>
    );
  }

  if (msg.type === "tool") {
    return <ToolIndicator msg={msg} />;
  }

  const isDm = msg.role === "dm";

  return (
    <div className={`chat-bubble ${isUser || isDm ? "user" : "agent"}`}>
      {isDm && msg.sender && (
        <div className="chat-dm-sender">&#x25C0; {msg.sender}</div>
      )}
      {msg.dmTo && (
        <div className="chat-dm-sender agent">&#x25B6; {msg.dmTo}</div>
      )}
      {msg.type === "voice" ? (
        <>
          <VoiceMessage msg={msg} />
          {msg.text && <p className="chat-voice-transcript">{msg.text}</p>}
        </>
      ) : (
        <>
          <div className="chat-md">{renderMarkdown(msg.text)}</div>
          {msg.type === "image" && (
            <div className="chat-image">
              <div className="chat-image-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>{msg.image_alt || "Image"}</span>
              </div>
            </div>
          )}
          {msg.attachments?.length > 0 && (
            <div className="chat-bubble-attachments">
              {msg.attachments.filter(a => a.type === "image").map((att, i) => (
                <img
                  key={i}
                  className="chat-bubble-att-image"
                  src={att._local ? att.url : authUrl(att.url)}
                  alt={att.label}
                  loading="lazy"
                  onClick={() => window.open(att._local ? att.url : authUrl(att.url), "_blank")}
                />
              ))}
              {msg.attachments.filter(a => a.type === "audio").map((att, i) => (
                <div key={i} className="chat-bubble-att-audio">
                  <span className="chat-bubble-att-label">{att.label}</span>
                  <audio controls preload="none" src={att._local ? att.url : authUrl(att.url)} />
                </div>
              ))}
              {msg.attachments.filter(a => a.type !== "image" && a.type !== "audio").map((att, i) => (
                <a
                  key={i}
                  className="chat-bubble-att-file"
                  href={att._local ? att.url : authUrl(att.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{typeIcon(att.type)}</span>
                  <span className="chat-bubble-att-name">{att.label}</span>
                  {att.size != null && <span className="chat-bubble-att-size">{formatSize(att.size)}</span>}
                </a>
              ))}
            </div>
          )}
        </>
      )}
      <div className="chat-meta">
        <span className="chat-time">{timeAgo(msg.timestamp)}</span>
        {msg.memories > 0 && (
          <span className="chat-memories">
            <ThoughtBubble size={12} />
            {msg.memories}
          </span>
        )}
      </div>
    </div>
  );
}
