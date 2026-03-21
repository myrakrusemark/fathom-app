import { useCallback, useRef, useState, useEffect } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { feedSanitizeSchema } from "../lib/sanitize.js";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import { sendReaction, postToRoom, readRoom } from "../api/client.js";
import { getConnection, getHumanUser } from "../lib/connection.js";
import ChatMessage from "./ChatMessage.jsx";

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSize(bytes) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


function authUrl(url) {
  const conn = getConnection();
  if (!conn) return url;
  const sep = url.includes("?") ? "&" : "?";
  return conn.serverUrl + url + sep + "token=" + conn.apiKey;
}

function stripChatDecorations(text) {
  // Strip @workspace prefix
  let cleaned = text.replace(/^@\S+\s/, "");
  // Strip trailing context block
  cleaned = cleaned.replace(/\n\n\(Context: reply to notification .+\)$/, "");
  return cleaned;
}

export default function FeedDetailPanel({ item, onClose, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const storageKey = `reaction:${item.id}`;
  const stored = localStorage.getItem(storageKey);
  const [reaction, setReaction] = useState(stored);
  const [sent, setSent] = useState(!!stored);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const inputRef = useRef(null);
  const pollRef = useRef(null);
  const roomName = `notif-${item.workspace}-${item.id}`;
  const lastSendStorageKey = `lastSend:${roomName}`;
  const lastSendRef = useRef((() => {
    const stored = sessionStorage.getItem(lastSendStorageKey);
    return stored ? Number(stored) : null;
  })());

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Poll room for replies while panel is open
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

  function handleSend(e) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    const now = Date.now();
    const gap = lastSendRef.current ? now - lastSendRef.current : Infinity;
    const needsContext = gap > 15 * 60 * 1000;
    let text = `@${item.workspace} ${message}`;
    if (needsContext) {
      text += `\n\n(Context: reply to notification ${item.id} — "${item.title}". Use fathom_room_read room="notification" to find the original, then reply in this room.)`;
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

  function handleReaction(type, e) {
    e.stopPropagation();
    if (sent) return;
    setReaction(type);
    setSent(true);
    localStorage.setItem(storageKey, type);
    sendReaction(item.workspace, type, item).catch(console.error);
  }

  const attachments = item.attachments || [];
  const images = attachments.filter((a) => a.type === "image" && !a.placeholder);
  const audioFiles = attachments.filter((a) => a.type === "audio");
  const files = attachments.filter((a) => a.type !== "image" && a.type !== "audio" && !a.placeholder);
  const placeholders = attachments.filter((a) => a.placeholder);

  const openLightbox = useCallback((index) => {
    const items = images.map((att) => ({ src: authUrl(att.url), alt: att.label, w: 800, h: 600 }));
    const img = new Image();
    img.src = items[index].src;
    const open = (w, h) => {
      items[index].w = w;
      items[index].h = h;
      const lightbox = new PhotoSwipeLightbox({
        dataSource: items,
        pswpModule: () => import("photoswipe"),
        bgOpacity: 0.9,
        pinchToClose: true,
      });
      lightbox.on("contentLoad", ({ content }) => {
        const el = content.element;
        if (el && el.tagName === "IMG") {
          el.onload = () => {
            content.data.w = el.naturalWidth;
            content.data.h = el.naturalHeight;
            content.instance.updateSize(true);
          };
        }
      });
      lightbox.init();
      lightbox.loadAndOpen(index);
    };
    if (img.naturalWidth) {
      open(img.naturalWidth, img.naturalHeight);
    } else {
      img.onload = () => open(img.naturalWidth, img.naturalHeight);
      img.onerror = () => open(800, 600);
    }
  }, [images]);

  return (
    <div className={`feed-panel-backdrop ${visible ? "visible" : ""}`} onClick={handleClose}>
      <div className={`feed-panel ${visible ? "visible" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="feed-panel-scroll">
          <div className="feed-panel-top-actions">
            {onDismiss && (
              <button className="feed-panel-dismiss" onClick={() => { onDismiss(); handleClose(); }} aria-label="Dismiss">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            <button className="feed-panel-close" onClick={handleClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="feed-panel-header">
            <span className="feed-item-dot" style={{ backgroundColor: item.workspace_color }} />
            <span className="feed-item-workspace">{item.workspace_name}</span>
            <span className="feed-item-time">{timeAgo(item.timestamp)}</span>
          </div>

          <h2 className="feed-panel-title">{item.title}</h2>

          <div className="feed-panel-body">
            <Markdown rehypePlugins={[rehypeRaw, [rehypeSanitize, feedSanitizeSchema]]}>{item.body}</Markdown>
          </div>

          {images.length > 0 && (
            <div className="feed-item-images">
              {images.map((att, i) => (
                <img
                  key={i}
                  className="feed-item-image"
                  src={authUrl(att.url)}
                  alt={att.label}
                  loading="lazy"
                  onClick={() => openLightbox(i)}
                />
              ))}
            </div>
          )}
          {audioFiles.length > 0 && (
            <div className="feed-item-audio-list">
              {audioFiles.map((att, i) => (
                <div key={i} className="feed-item-audio">
                  <span className="feed-item-audio-label">{att.label}</span>
                  <audio controls preload="none" src={authUrl(att.url)} />
                </div>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="feed-item-files">
              {files.map((att, i) => (
                <a
                  key={i}
                  className="feed-item-file-chip"
                  href={authUrl(att.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="file-chip-label">{att.label}</span>
                  {att.size != null && (
                    <span className="file-chip-size">{formatSize(att.size)}</span>
                  )}
                  <span className="file-chip-download">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  </span>
                </a>
              ))}
            </div>
          )}
          {placeholders.length > 0 && (
            <div className="feed-item-images">
              {placeholders.map((att, i) => (
                <div key={i} className="feed-item-image-placeholder">{att.label}</div>
              ))}
            </div>
          )}

          <div className="feed-panel-actions">
            {sent ? (
              <span className="action-confirmed">
                {reaction === "up" ? "\uD83D\uDC4D" : "\uD83D\uDC4E"} Thanks for your feedback!
              </span>
            ) : (
              <>
                <button className="action-btn" onClick={(e) => handleReaction("up", e)}>
                  <span role="img" aria-label="thumbs up">&#x1F44D;</span>
                </button>
                <button className="action-btn" onClick={(e) => handleReaction("down", e)}>
                  <span role="img" aria-label="thumbs down">&#x1F44E;</span>
                </button>
              </>
            )}
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
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Chat about this with ${item.workspace_name || "fathom"}...`}
              disabled={sending}
              autoComplete="off"
            />
            <button type="submit" disabled={!message.trim() || sending}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
