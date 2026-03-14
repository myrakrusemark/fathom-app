import { useState, useEffect, useRef, useCallback } from "react";
import { getWsUrl, getWorkspace, sendMessage } from "../api/client.js";

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

function ToolIndicator({ msg }) {
  return (
    <div className="chat-tool-use">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
      <span className="chat-tool-name">{msg.name || "working"}</span>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
              <path d="M7.5 3.5a5.5 5.5 0 019.32 4.7A4 4 0 0118 16H6a4 4 0 01-.78-7.92A5.5 5.5 0 017.5 3.5z" />
              <circle cx="7" cy="19.5" r="1.2" />
              <circle cx="5" cy="22" r="0.8" />
            </svg>
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

function eventToMessage(event) {
  const id = `ws-${++msgCounter}`;
  const timestamp = event.timestamp || new Date().toISOString();

  switch (event.event_type) {
    case "assistant":
      return { id, role: "agent", type: "text", text: event.data?.content || "", timestamp, memories: event.data?.memories || 0 };
    case "user":
      return { id, role: "user", type: "text", text: event.data?.content || "", timestamp, memories: 0 };
    case "tool_use":
      return { id, role: "agent", type: "tool", name: event.data?.name || "tool", status: event.data?.status || "done", timestamp };
    case "thinking":
      return { id, role: "agent", type: "working", timestamp };
    case "error":
      return { id, role: "agent", type: "text", text: `Error: ${event.data?.message || "unknown"}`, timestamp, memories: 0 };
    default:
      return null;
  }
}

export default function ChatSheet({ open, onClose, consumeVoice, pendingVoice, feedMode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sheetRef = useRef(null);
  const wsRef = useRef(null);

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
          const msgs = data.events.map(eventToMessage).filter(Boolean);
          setMessages(msgs);
          return;
        }

        if (data.type === "event") {
          const msg = eventToMessage(data);
          if (msg) {
            // Replace working indicator with actual message
            if (msg.type !== "working") {
              setMessages((prev) => prev.filter((m) => m.type !== "working").concat(msg));
            } else {
              setMessages((prev) => {
                if (prev.some((m) => m.type === "working")) return prev;
                return [...prev, msg];
              });
            }
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
  }, [messages]);

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
