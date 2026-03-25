import { useCallback, useRef, useState, useEffect } from "react";
import { Play, Pause, Check, X, Send, Download, ThumbsUp, ThumbsDown } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import { feedSanitizeSchema } from "../lib/sanitize.js";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import { sendReaction, postToRoom, readRoom } from "../api/client.js";
import { getHumanUser } from "../lib/connection.js";
import { useAudioPlayer } from "../contexts/AudioPlayerContext.jsx";
import ChatMessage from "./ChatMessage.jsx";
import { timeAgo, stripChatDecorations, authUrl, formatSize } from "../lib/formatters.js";

function FeedAudioItem({ att }) {
  const { play, pause, playing, track } = useAudioPlayer();
  const url = authUrl(att.url);
  const isThisPlaying = playing && track?.url === url;

  function handleClick() {
    if (isThisPlaying) { pause(); return; }
    play(url, att.label || "Audio", "audio");
  }

  return (
    <div className="feed-item-audio" onClick={handleClick}>
      {isThisPlaying ? (
        <Pause size={14} fill="currentColor" className="feed-item-audio-icon" />
      ) : (
        <Play size={14} fill="currentColor" className="feed-item-audio-icon" />
      )}
      <span className="feed-item-audio-label">{att.label}</span>
    </div>
  );
}

/** Try to parse text as notification JSON. Returns parsed object or null. */
function tryParseNotificationJson(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj.title || obj.body || obj.attachments) return obj;
  } catch { /* not JSON */ }
  return null;
}

function ThreadNotification({ notif, timestamp }) {
  const attachments = notif.attachments || [];
  const images = attachments.filter((a) => a.type === "image");
  const audioFiles = attachments.filter((a) => a.type === "audio");
  const files = attachments.filter((a) => a.type !== "image" && a.type !== "audio");

  return (
    <div className="thread-notification">
      {notif.title && <h4 className="thread-notification-title">{notif.title}</h4>}
      {notif.body && (
        <div className="thread-notification-body">
          <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex, [rehypeSanitize, feedSanitizeSchema]]}>{notif.body}</Markdown>
        </div>
      )}
      {images.length > 0 && (
        <div className="feed-item-images">
          {images.map((att, i) => (
            <img key={att.url || i} className="feed-item-image" src={authUrl(att.url)} alt={att.label} loading="lazy" />
          ))}
        </div>
      )}
      {audioFiles.length > 0 && (
        <div className="feed-item-audio-list">
          {audioFiles.map((att, i) => (
            <FeedAudioItem key={att.url || i} att={att} />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="feed-item-files">
          {files.map((att, i) => (
            <a key={att.url || i} className="feed-item-file-chip" href={authUrl(att.url)} target="_blank" rel="noopener noreferrer">
              <span className="file-chip-label">{att.label || att.caption}</span>
              {att.size != null && <span className="file-chip-size">{formatSize(att.size)}</span>}
              <span className="file-chip-download"><Download size={14} /></span>
            </a>
          ))}
        </div>
      )}
      <div className="chat-meta">
        <span className="chat-time">{timeAgo(timestamp)}</span>
      </div>
    </div>
  );
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
          <div className="feed-panel-header">
            <span className="feed-item-dot" style={{ backgroundColor: item.workspace_color }} />
            <span className="feed-item-workspace">{item.workspace_name}</span>
            <span className="feed-item-time">{timeAgo(item.timestamp)}</span>
            {onDismiss && (
              <button className="feed-panel-dismiss" onClick={(e) => { e.stopPropagation(); onDismiss(); handleClose(); }} aria-label="Dismiss">
                <Check size={14} strokeWidth={2.5} />
                <span>Dismiss</span>
              </button>
            )}
            <button className="feed-panel-dismiss" onClick={handleClose} aria-label="Close">
              <X size={14} />
              <span>Close</span>
            </button>
          </div>

          <h2 className="feed-panel-title">{item.title}</h2>

          {item.image && (
            <div className="feed-panel-hero-image">
              <img src={authUrl(item.image)} alt={item.title} loading="lazy" crossOrigin="anonymous" />
            </div>
          )}

          <div className="feed-panel-body">
            <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex, [rehypeSanitize, feedSanitizeSchema]]}>{item.body}</Markdown>
          </div>

          {images.length > 0 && (
            <div className="feed-item-images">
              {images.map((att, i) => (
                <img
                  key={att.url || i}
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
                <FeedAudioItem key={att.url || i} att={att} />
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="feed-item-files">
              {files.map((att, i) => (
                <a
                  key={att.url || i}
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
                    <Download size={14} />
                  </span>
                </a>
              ))}
            </div>
          )}
          {placeholders.length > 0 && (
            <div className="feed-item-images">
              {placeholders.map((att, i) => (
                <div key={att.label || i} className="feed-item-image-placeholder">{att.label}</div>
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
                  <ThumbsUp size={16} />
                </button>
                <button className="action-btn" onClick={(e) => handleReaction("down", e)}>
                  <ThumbsDown size={16} />
                </button>
              </>
            )}
          </div>

          {chatMessages.length > 0 && (
            <div className="feed-panel-chat">
              <div className="feed-panel-chat-label">Thread</div>
              {chatMessages.map((msg) => {
                const humanUser = getHumanUser();
                const isAgent = msg.sender !== humanUser;
                const notif = isAgent ? tryParseNotificationJson(msg.text) : null;
                if (notif) {
                  return <ThreadNotification key={msg.id} notif={notif} timestamp={msg.timestamp} />;
                }
                return (
                  <ChatMessage
                    key={msg.id}
                    msg={{
                      id: msg.id,
                      role: isAgent ? "agent" : "user",
                      type: "text",
                      text: stripChatDecorations(msg.text),
                      timestamp: msg.timestamp,
                      memories: 0,
                    }}
                  />
                );
              })}
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
              <Send size={20} fill="currentColor" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
