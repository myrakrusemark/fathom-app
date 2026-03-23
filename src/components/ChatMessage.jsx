/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Play, Pause, Mic, Wrench, Clock, ChevronDown, Check, Image } from "lucide-react";
import { getConnection } from "../lib/connection.js";
import { useAudioPlayer } from "../contexts/AudioPlayerContext.jsx";
import ThoughtBubble from "./ThoughtBubble.jsx";
import { timeAgo as timeAgoFn } from "../lib/formatters.js";

export function timeAgo(timestamp) {
  return timeAgoFn(timestamp, { short: true });
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
  const { play, pause, playing, track } = useAudioPlayer();

  const conn = getConnection();
  const baseUrl = conn?.serverUrl || "";
  const fullUrl = msg.audio_url ? `${baseUrl}${msg.audio_url}` : null;
  const isThisPlaying = playing && track?.url === fullUrl;

  function handlePlay() {
    if (!fullUrl) return;
    if (isThisPlaying) { pause(); return; }
    play(fullUrl, "Voice message", "voice");
  }

  return (
    <div
      className={`chat-voice ${msg.audio_url ? "playable" : ""} ${isThisPlaying ? "playing" : ""}`}
      onClick={handlePlay}
    >
      {msg.audio_url ? (
        isThisPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />
      ) : (
        <Mic size={16} />
      )}
      <div className="chat-voice-wave">
        {VOICE_BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className={`chat-voice-bar ${isThisPlaying ? "animating" : ""}`}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <span className="chat-voice-dur">{msg.duration}s</span>
    </div>
  );
}

function AudioAttachment({ att }) {
  const { play, pause, playing, track } = useAudioPlayer();
  const url = att._local ? att.url : authUrl(att.url);
  const isThisPlaying = playing && track?.url === url;

  function handleClick() {
    if (isThisPlaying) { pause(); return; }
    play(url, att.label || "Audio", "audio");
  }

  return (
    <div className="chat-bubble-att-audio" onClick={handleClick}>
      {isThisPlaying ? (
        <Pause size={14} fill="currentColor" className="chat-bubble-att-audio-icon" />
      ) : (
        <Play size={14} fill="currentColor" className="chat-bubble-att-audio-icon" />
      )}
      <span className="chat-bubble-att-label">{att.label}</span>
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
          <Wrench size={12} />
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
        <Clock size={12} />
        <span className="chat-ping-label">ping</span>
        <span className="chat-ping-title">{firstLine.replace(/^\[|\]$/g, "")}</span>
        {rest && (
          <ChevronDown
            className="chat-ping-chevron"
            size={12}
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          />
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
        <Check size={14} strokeWidth={2.5} />
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
                <Image size={24} strokeWidth={1.5} />
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
                <AudioAttachment key={i} att={att} />
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
