import { useState, useEffect, useRef, useCallback } from "react";
import { getWsUrl, getWorkspace, sendMessage } from "../api/client.js";
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

const VOICE_BAR_HEIGHTS = [12, 8, 18, 6, 15, 10, 19, 7, 14, 11, 17, 9];

function VoiceMessage({ msg }) {
  return (
    <div className="chat-voice">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <path d="M12 19v4M8 23h8" />
      </svg>
      <div className="chat-voice-wave">
        {VOICE_BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="chat-voice-bar"
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
    <div className="chat-tool-use">
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
      .filter((b) => b.type === "text")
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
      if (block.type === "text" && block.text) {
        // <...> is active silence — render as presence indicator, not text
        if (block.text.trim() === "<...>") {
          out.push({ id, role: "agent", type: "presence", timestamp: ts });
          continue;
        }
        out.push({ id, role: "agent", type: "text", text: block.text, timestamp: ts, memories: 0 });
      } else if (block.type === "tool_use") {
        out.push({ id, role: "agent", type: "tool", name: block.name || "tool", status: "done", timestamp: ts });
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
    const source = data.source || "";
    // Only show dashboard-injected messages as user messages
    if (source === "dashboard" && content) {
      return [{ id: `ws-${seq}`, role: "user", type: "text", text: content, timestamp: ts, memories: 0 }];
    }
    return [];
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
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sheetRef = useRef(null);
  const wsRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

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
          const msgs = attachMemoryCounts(data.events.flatMap(eventToMessages));
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
      const voice = consumeVoice();
      if (voice) {
        setInput(voice);
        const t = setTimeout(() => inputRef.current?.focus(), 350);
        return () => clearTimeout(t);
      }
    } else if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [open, pendingVoice, consumeVoice]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    // Optimistically add user message
    const userMsg = {
      id: `local-${++msgCounter}`,
      role: "user",
      type: "text",
      text,
      timestamp: new Date().toISOString(),
      memories: 0,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      await sendMessage(text);
      // Response will come through WebSocket
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
          {messages.map((msg) => (
            <ChatMessage key={msg.id} msg={msg} />
          ))}
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
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="say something..."
            disabled={sending}
            autoComplete="off"
          />
          <button type="submit" disabled={!input.trim() || sending}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
