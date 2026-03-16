import { useState, useEffect, useRef, useCallback } from "react";
import { getWsUrl, getWorkspace, sendMessage, uploadAttachment } from "../api/client.js";
import ChatMessage, { ToolGroup, formatSize } from "./ChatMessage.jsx";

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
