import { useState, useEffect, useRef, useCallback } from "react";
import { getWsUrl, getWorkspace, sendMessage, uploadAttachment } from "../api/client.js";
import { getConnection } from "../lib/connection.js";
import ThoughtBubble from "./ThoughtBubble.jsx";

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function renderMarkdown(text) {
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

function formatSize(bytes) {
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

function authUrl(url) {
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

/** Clean up MCP tool names for display and pick an appropriate icon. */
function toolDisplay(name) {
  if (!name) return { label: "working", icon: "tool" };
  // Memory operations get the cloud icon
  if (name.includes("memento_remember") || name.includes("memento_recall")) {
    return { label: "remembering", icon: "memory" };
  }
  if (name.includes("memento_consolidate")) {
    return { label: "consolidating memories", icon: "memory" };
  }
  if (name.includes("memento_item_create") || name.includes("memento_item_update")) {
    return { label: "updating memory", icon: "memory" };
  }
  if (name.includes("memento_")) {
    const short = name.replace(/^mcp__memento__/, "").replace(/^memento_/, "");
    return { label: short, icon: "memory" };
  }
  // Telegram
  if (name.includes("telegram_send")) return { label: "sending message", icon: "tool" };
  if (name.includes("telegram_read")) return { label: "reading messages", icon: "tool" };
  // Vault
  if (name.includes("vault_search") || name.includes("vault_vsearch") || name.includes("vault_query")) {
    return { label: "searching vault", icon: "tool" };
  }
  // Strip MCP prefixes for everything else
  const clean = name.replace(/^mcp__[^_]+__/, "");
  return { label: clean, icon: "tool" };
}

function ToolIndicator({ msg }) {
  const { label, icon } = toolDisplay(msg.name);
  return (
    <span className="chat-tool-use">
      {icon === "memory" ? (
        <ThoughtBubble size={20} color="var(--accent)" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      )}
      <span className="chat-tool-name">{label}</span>
      {msg.status === "running" && (
        <span className="chat-tool-status">
          <span className="chat-working-dot" />
          <span className="chat-working-dot" />
          <span className="chat-working-dot" />
        </span>
      )}
    </span>
  );
}

function ToolGroup({ tools }) {
  return (
    <div className="chat-tool-group">
      {tools.map((msg) => (
        <ToolIndicator key={msg.id} msg={msg} />
      ))}
    </div>
  );
}

function ChatMessage({ msg }) {
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

  return (
    <div className={`chat-bubble ${isUser ? "user" : "agent"}`}>
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

const FRESH_CHAT_MESSAGES = [
  {
    id: "fresh-1",
    role: "agent",
    type: "text",
    text: "Everything you just saw in your feed? I set that up based on what you told me. But that's just the start.\n\nYou can ask me to create new workspaces for anything — a side project, a research topic, tracking something specific. I can add routines that run on schedules or conditions you define. And I manage all of it from here.\n\nThink of this chat as your control room. You talk to me, and I coordinate everything else.",
    timestamp: new Date().toISOString(),
    memories: 0,
  },
];

let msgCounter = 0;

/** Extract plain text from content — handles string, content block array, or object. */
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === "text" || (!b.type && b.text))
      .map((b) => b.text || "")
      .join("");
  }
  if (content && typeof content === "object") return content.text || "";
  return "";
}

/** Convert a raw conversation event into one or more renderable messages.
 *  Returns an array since one assistant event can contain text + tool_use blocks. */
function eventToMessages(event) {
  const evType = event.type || event.event_type;
  const data = event.data || {};
  // Timestamps come as Unix seconds from the server
  const ts = event.timestamp
    ? typeof event.timestamp === "number"
      ? new Date(event.timestamp * 1000).toISOString()
      : event.timestamp
    : new Date().toISOString();
  const seq = event.seq || 0;

  if (evType === "assistant") {
    const content = data.message?.content || data.content || "";
    const blocks = Array.isArray(content)
      ? content
      : typeof content === "string" && content
        ? [{ type: "text", text: content }]
        : [];
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const id = `ws-${seq}-${i}`;
      if ((block.type === "text" || (!block.type && block.text)) && block.text) {
        // <...> is active silence — render as presence indicator, not text
        if (block.text.trim() === "<...>") {
          out.push({ id, role: "agent", type: "presence", timestamp: ts });
          continue;
        }
        out.push({ id, role: "agent", type: "text", text: block.text, timestamp: ts, memories: 0 });
      } else if (block.type === "tool_use" || (!block.type && block.name)) {
        const toolName = block.name || "tool";
        // Voice send — render as playable voice message using input text
        if (toolName.includes("send_voice") && block.input?.text) {
          out.push({ id, role: "agent", type: "voice", text: block.input.text, duration: 0, audio_url: null, timestamp: ts, memories: 0, _toolId: block.id });
        } else {
          out.push({ id, role: "agent", type: "tool", name: toolName, status: "done", timestamp: ts });
        }
      } else if (block.type === "thinking") {
        // Working indicator handled by isProcessing state — no message needed
      }
    }
    return out;
  }

  if (evType === "user") {
    // Skip tool results — only show real user messages
    if (data.parent_tool_use_id) return [];
    const content = data.message?.content || data.content || "";
    // Content arrays with tool_use_id are tool results, not user messages
    if (Array.isArray(content) && content[0]?.tool_use_id) return [];
    const text = extractText(content);
    if (!text) return [];
    // Hook content (memento recall, stop hooks) — extract memory count, don't render as message
    const firstLine = text.split("\n")[0] || "";
    const isHook = firstLine.startsWith("Stop hook") || firstLine.startsWith("Memento") || text.length > 300;
    if (isHook) {
      // Count memory bullets (🔹) to get recall count
      const bulletCount = (text.match(/🔹/g) || []).length;
      if (bulletCount > 0) {
        // Emit a hidden marker that the post-processing pass will attach to adjacent messages
        return [{ id: `ws-${seq}`, role: "hook", type: "memory-count", memories: bulletCount, timestamp: ts, isStop: firstLine.startsWith("Stop hook") }];
      }
      return [];
    }
    return [{ id: `ws-${seq}`, role: "user", type: "text", text, timestamp: ts, memories: 0 }];
  }

  if (evType === "injected") {
    const content = data.content || "";
    if (!content) return [];

    // Voice messages from app
    const voiceMatch = content.match(/^\[voice message from .*?\]: (.+?)(?:\n\(This was a voice message\.)/s);
    if (voiceMatch) {
      return [{ id: `ws-${seq}`, role: "user", type: "voice", text: voiceMatch[1], duration: 0, audio_url: null, timestamp: ts, memories: 0 }];
    }

    // Dashboard messages with attachments
    if (data.attachments?.length > 0) {
      // Strip the [attachment: ...] prefix from display text
      const displayText = content.replace(/^\[attachment:.*?\]\n?/g, "").trim();
      return [{
        id: `ws-${seq}`,
        role: "user",
        type: "text",
        text: displayText || null,
        attachments: data.attachments,
        timestamp: ts,
        memories: 0,
      }];
    }

    // Memory recall hooks — extract count and attach to adjacent messages
    if (content.startsWith("Stop hook feedback:") || content.startsWith("Memento")) {
      const bulletCount = (content.match(/🔹/g) || []).length;
      if (bulletCount > 0) {
        return [{ id: `ws-${seq}`, role: "hook", type: "memory-count", memories: bulletCount, timestamp: ts, isStop: content.startsWith("Stop hook") }];
      }
      return [];
    }

    // DM from another workspace
    const dmMatch = content.match(/^Message from workspace \((.+?)\): (.+)/s);
    if (dmMatch) {
      return [{ id: `ws-${seq}`, role: "user", type: "text", text: `${dmMatch[1]}: ${dmMatch[2]}`, timestamp: ts, memories: 0 }];
    }

    // DM delivery notifications
    if (content.startsWith("DM from ")) {
      const dmText = content.split("\n")[0].replace(/^DM from \S+: /, "");
      return [{ id: `ws-${seq}`, role: "user", type: "text", text: dmText, timestamp: ts, memories: 0 }];
    }

    // Session continuation prompts — skip
    if (content === "Continue from where you left off.") return [];

    // Dashboard messages and general user input
    const source = data.source || "";
    if (source === "dashboard" || source === "voice" || source === "history") {
      // Filter out long hook content that slipped through
      if (content.length > 300) return [];
      return [{ id: `ws-${seq}`, role: "user", type: "text", text: content, timestamp: ts, memories: 0 }];
    }

    return [];
  }

  if (evType === "voice") {
    return [{
      id: `ws-${seq}`,
      role: data.role || "user",
      type: "voice",
      text: data.text || "",
      duration: data.duration || 0,
      audio_url: data.audio_url || null,
      timestamp: ts,
      memories: 0,
    }];
  }

  if (evType === "hook") {
    const memories = data.memories || 0;
    if (memories > 0) {
      return [{ id: `ws-${seq}`, role: "hook", type: "memory-count", memories, timestamp: ts, isStop: false }];
    }
    return [];
  }

  if (evType === "system") {
    const subtype = data.subtype || "";
    if (subtype === "compaction" || subtype === "compact_boundary") {
      return [{ id: `ws-${seq}`, role: "system", type: "presence", timestamp: ts, label: "context compacted" }];
    }
    return [];
  }

  if (evType === "status") {
    const sub = data.subtype || "";
    if (sub === "compaction") {
      return [{ id: `ws-${seq}`, role: "system", type: "presence", timestamp: ts, label: "context compacted" }];
    }
    return [];
  }

  if (evType === "result") {
    const turns = data.num_turns || data.turns;
    const duration = data.duration_ms;
    const label = [
      turns !== undefined ? `Turns: ${turns}` : null,
      duration !== undefined ? `${(duration / 1000).toFixed(1)}s` : null,
    ].filter(Boolean).join("  ");
    if (label) {
      return [{ id: `ws-${seq}`, role: "system", type: "meta", timestamp: ts, label }];
    }
    return [];
  }

  return [];
}

/** Enrich agent voice messages with audio_url from tool results. */
function enrichVoiceMessages(msgs, rawEvents) {
  // Build a map of tool_use_id → audio_url from tool results
  const audioMap = {};
  for (const ev of rawEvents) {
    if (ev.type !== "user") continue;
    const content = ev.data?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block.tool_use_id) continue;
      // Tool result content can be a string or array of blocks
      const resultText = Array.isArray(block.content)
        ? block.content.find(b => b.type === "text")?.text
        : typeof block.content === "string" ? block.content : null;
      if (!resultText) continue;
      try {
        const parsed = JSON.parse(resultText);
        if (parsed.audio_url) {
          audioMap[block.tool_use_id] = { audio_url: parsed.audio_url, duration: parsed.duration || 0 };
        }
      } catch { /* not JSON */ }
    }
  }

  // Enrich voice messages that have _toolId
  for (const msg of msgs) {
    if (msg.type === "voice" && msg._toolId && audioMap[msg._toolId]) {
      msg.audio_url = audioMap[msg._toolId].audio_url;
      msg.duration = audioMap[msg._toolId].duration;
      delete msg._toolId;
    }
  }
  return msgs;
}

/** Post-process messages: attach memory counts from hook markers to adjacent messages, then remove markers. */
function attachMemoryCounts(msgs) {
  // Pass 1: attach counts
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].type !== "memory-count") continue;
    const { memories, isStop } = msgs[i];
    if (isStop) {
      // Stop hook recall → attach to the most recent agent message before this marker
      for (let j = i - 1; j >= 0; j--) {
        if (msgs[j].role === "agent" && (msgs[j].type === "text" || msgs[j].type === "presence")) {
          msgs[j].memories = (msgs[j].memories || 0) + memories;
          break;
        }
      }
    } else {
      // UserPromptSubmit hook recall → attach to the most recent user message before this marker
      for (let j = i - 1; j >= 0; j--) {
        if (msgs[j].role === "user" && msgs[j].type === "text") {
          msgs[j].memories = (msgs[j].memories || 0) + memories;
          break;
        }
      }
    }
  }
  // Pass 2: remove markers
  return msgs.filter((m) => m.type !== "memory-count");
}

export default function ChatSheet({ open, onClose, consumeVoice, pendingVoice, feedMode, onUnread }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const sheetRef = useRef(null);
  const wsRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview(null);
      return;
    }
    if (pendingFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(pendingFile);
      setPendingPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPendingPreview(null);
  }, [pendingFile]);

  const connectWs = useCallback(() => {
    const ws = getWorkspace();
    const url = getWsUrl(`/ws/conversation/${ws}`);
    if (!url) return;

    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => setWsConnected(true);

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "history" && Array.isArray(data.events)) {
          const msgs = attachMemoryCounts(enrichVoiceMessages(data.events.flatMap(eventToMessages), data.events));
          // Merge with any optimistic local messages not yet echoed
          setMessages((prev) => {
            const localPending = prev.filter((m) => m.id.startsWith("local-") && !msgs.some((wm) => wm.role === "user" && wm.text === m.text));
            return [...msgs, ...localPending];
          });
          return;
        }

        if (data.type === "event") {
          if (data.event_type === "assistant") {
            setIsProcessing(true);
          }
          if (data.event_type === "result") {
            setIsProcessing(false);
          }
          // Normalize: real-time events have event_type at top level
          const normalized = {
            seq: data.seq,
            type: data.event_type,
            data: data.data,
            timestamp: data.timestamp,
          };
          const newMsgs = eventToMessages(normalized);
          // Track unread agent messages when chat is closed
          if (!openRef.current && onUnread) {
            const agentTexts = newMsgs.filter((m) => m.role === "agent" && m.type === "text");
            if (agentTexts.length > 0) onUnread(agentTexts.length);
          }
          if (newMsgs.length > 0) {
            setMessages((prev) => {
              // Handle memory-count markers: attach to adjacent messages
              const memoryMarkers = newMsgs.filter((m) => m.type === "memory-count");
              const regularMsgs = newMsgs.filter((m) => m.type !== "memory-count");

              let base = prev;
              // Attach memory counts to existing messages
              if (memoryMarkers.length > 0) {
                base = [...prev];
                for (const marker of memoryMarkers) {
                  if (marker.isStop) {
                    setIsProcessing(false);
                    // Stop hook → attach to last agent message
                    for (let j = base.length - 1; j >= 0; j--) {
                      if (base[j].role === "agent" && (base[j].type === "text" || base[j].type === "presence")) {
                        base[j] = { ...base[j], memories: (base[j].memories || 0) + marker.memories };
                        break;
                      }
                    }
                  } else {
                    // UserPromptSubmit hook → attach to last user message
                    for (let j = base.length - 1; j >= 0; j--) {
                      if (base[j].role === "user" && base[j].type === "text") {
                        base[j] = { ...base[j], memories: (base[j].memories || 0) + marker.memories };
                        break;
                      }
                    }
                  }
                }
              }

              if (regularMsgs.length === 0) return base;

              // Deduplicate: if a WS user message matches an optimistic local message, replace it
              const fresh = [];
              for (const msg of regularMsgs) {
                if (msg.role === "user" && msg.type === "text") {
                  const localIdx = base.findIndex((m) => m.id.startsWith("local-") && m.role === "user" && m.text === msg.text);
                  if (localIdx !== -1) {
                    base[localIdx] = { ...base[localIdx], id: msg.id };
                    continue;
                  }
                }
                if (!base.some((m) => m.id === msg.id)) {
                  fresh.push(msg);
                }
              }
              return [...base, ...fresh];
            });
          }
          return;
        }

        // ping events — ignore for now
      } catch {
        // ignore parse errors
      }
    };

    socket.onclose = () => {
      setWsConnected(false);
      setIsProcessing(false);
      wsRef.current = null;
    };

    socket.onerror = () => {
      setWsConnected(false);
    };
  }, []);

  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, []);

  useEffect(() => {
    if (open) {
      if (feedMode === "fresh") {
        setMessages(FRESH_CHAT_MESSAGES);
      } else {
        connectWs();
      }
    } else {
      disconnectWs();
    }
    return () => disconnectWs();
  }, [open, feedMode, connectWs, disconnectWs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  useEffect(() => {
    if (open && pendingVoice) {
      // Voice was already sent via sendVoice API — just consume and clear
      consumeVoice();
    }
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [open, pendingVoice, consumeVoice]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    const file = pendingFile;
    if ((!text && !file) || sending) return;

    setInput("");
    setPendingFile(null);
    setSending(true);

    // Optimistically add user message
    const userMsg = {
      id: `local-${++msgCounter}`,
      role: "user",
      type: "text",
      text: text || null,
      timestamp: new Date().toISOString(),
      memories: 0,
    };
    if (file) {
      userMsg.attachments = [{
        url: pendingPreview || null,
        label: file.name,
        type: file.type.startsWith("image/") ? "image"
          : file.type.startsWith("audio/") ? "audio"
          : "document",
        size: file.size,
        _local: true,
      }];
    }
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      if (file) {
        await uploadAttachment(file, text);
      } else {
        await sendMessage(text);
      }
    } catch (err) {
      const errMsg = {
        id: `err-${++msgCounter}`,
        role: "agent",
        type: "text",
        text: `Failed to send: ${err.message}`,
        timestamp: new Date().toISOString(),
        memories: 0,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleBackdropClick(e) {
    if (e.target === sheetRef.current) {
      onClose();
    }
  }

  return (
    <div
      ref={sheetRef}
      className={`chat-sheet-backdrop ${open ? "open" : ""}`}
      onClick={handleBackdropClick}
    >
      <div className={`chat-sheet ${open ? "open" : ""}`}>
        <div className="chat-sheet-handle" onClick={onClose}>
          <div className="handle-bar" />
        </div>
        <div className="chat-sheet-header">
          <span className="chat-sheet-title">
            fathom
            {open && !feedMode.startsWith("fresh") && (
              <span className={`connection-dot inline ${wsConnected ? "connected" : "disconnected"}`} />
            )}
          </span>
          <button className="chat-sheet-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="chat-sheet-messages">
          {(() => {
            const grouped = [];
            let i = 0;
            while (i < messages.length) {
              if (messages[i].type === "tool") {
                const tools = [];
                while (i < messages.length && messages[i].type === "tool") {
                  tools.push(messages[i]);
                  i++;
                }
                grouped.push(<ToolGroup key={tools[0].id} tools={tools} />);
              } else {
                grouped.push(<ChatMessage key={messages[i].id} msg={messages[i]} />);
                i++;
              }
            }
            return grouped;
          })()}
          {isProcessing && (
            <div className="chat-working">
              <span className="chat-working-dot" />
              <span className="chat-working-dot" />
              <span className="chat-working-dot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form className="chat-sheet-input" onSubmit={handleSend}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.json,.md"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendingFile(f);
              e.target.value = "";
            }}
          />
          {pendingFile && (
            <div className="chat-preview-strip">
              {pendingPreview ? (
                <img className="chat-preview-thumb" src={pendingPreview} alt="" />
              ) : (
                <div className="chat-preview-file">
                  <span>{pendingFile.name}</span>
                  <span className="chat-preview-size">{formatSize(pendingFile.size)}</span>
                </div>
              )}
              <button
                type="button"
                className="chat-preview-dismiss"
                onClick={() => setPendingFile(null)}
              >
                &times;
              </button>
            </div>
          )}
          <div className="chat-input-row">
            <button
              type="button"
              className="chat-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="say something..."
              disabled={sending}
              autoComplete="off"
            />
            <button type="submit" disabled={(!input.trim() && !pendingFile) || sending}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
