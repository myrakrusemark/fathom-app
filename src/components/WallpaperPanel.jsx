import { useRef, useState, useEffect } from "react";
import { X, Send, Download } from "lucide-react";
import { postToRoom, readRoom } from "../api/client.js";
import { getHumanUser } from "../lib/connection.js";
import ChatMessage from "./ChatMessage.jsx";
import { stripChatDecorations } from "../lib/formatters.js";
import ChatInput from "./ChatInput.jsx";

export default function WallpaperPanel({ wallpaper, onClose }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const inputRef = useRef(null);
  const pollRef = useRef(null);
  const roomName = `wallp-${wallpaper.sender}-${wallpaper.id}`;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Poll wallpaper-chat room for thread messages
  useEffect(() => {
    function poll() {
      readRoom(roomName, 1440, getHumanUser())
        .then((data) => {
          const msgs = (data.messages || []).map((m) => ({
            id: m.id,
            sender: m.sender,
            text: m.message,
            timestamp: m.timestamp,
          }));
          setChatMessages(msgs);
        })
        .catch(() => {});
    }
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [roomName]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const lastSendStorageKey = `lastSend:${roomName}`;
  const lastSendRef = useRef((() => {
    const stored = sessionStorage.getItem(lastSendStorageKey);
    return stored ? Number(stored) : null;
  })());

  function handleSend(e) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    const now = Date.now();
    const gap = lastSendRef.current ? now - lastSendRef.current : Infinity;
    const needsContext = gap > 15 * 60 * 1000;
    let text = `@${wallpaper.sender} ${message}`;
    if (needsContext) {
      text += `\n\n(Context: reply about wallpaper ${wallpaper.id} — "${wallpaper.reason}". Read #wallpaper room for the original, then reply in this room.)`;
    }
    postToRoom(roomName, text)
      .then(() => {
        lastSendRef.current = now;
        sessionStorage.setItem(lastSendStorageKey, String(now));
        setMessage("");
        setChatMessages((prev) => [
          ...prev,
          { id: `local-${Date.now()}`, sender: getHumanUser(), text, timestamp: new Date().toISOString() },
        ]);
      })
      .catch(console.error)
      .finally(() => setSending(false));
  }

  return (
    <div className={`feed-panel-backdrop ${visible ? "visible" : ""}`} onClick={handleClose}>
      <div className={`feed-panel ${visible ? "visible" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="feed-panel-scroll">
          <div className="feed-panel-header">
            <span className="feed-item-dot" style={{ backgroundColor: "#6366f1" }} />
            <span className="feed-item-workspace">Wallpaper</span>
            <button className="feed-panel-dismiss" onClick={handleClose} aria-label="Close">
              <X size={14} />
              <span>Close</span>
            </button>
          </div>

          <h2 className="feed-panel-title">Why this wallpaper?</h2>

          {wallpaper.url && (
            <div className="feed-panel-hero-image">
              <img src={wallpaper.url} alt="Current wallpaper" loading="lazy" crossOrigin="anonymous" />
              <a className="wallpaper-download" href={wallpaper.url} download target="_blank" rel="noopener noreferrer">
                <Download size={14} />
                <span>Download</span>
              </a>
            </div>
          )}

          <div className="feed-panel-body">
            <p>{wallpaper.reason}</p>
          </div>

          {chatMessages.length > 0 && (
            <div className="feed-panel-chat">
              <div className="feed-panel-chat-label">Thread</div>
              {chatMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  msg={{
                    id: msg.id,
                    role: msg.sender === getHumanUser() ? "user" : "agent",
                    type: "text",
                    text: stripChatDecorations(msg.text),
                    timestamp: msg.timestamp,
                    memories: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="feed-panel-bottom">
          <form className="feed-panel-input" onSubmit={handleSend}>
            <ChatInput
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onSubmit={() => { if (message.trim() && !sending) handleSend({ preventDefault() {} }); }}
              placeholder="Chat about the wallpaper..."
              disabled={sending}
              autoComplete="off"
            />
            <button type="submit" disabled={!message.trim() || sending}>
              <Send size={20} fill="currentColor" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
