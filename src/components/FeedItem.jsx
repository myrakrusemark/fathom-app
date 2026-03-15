import { useCallback, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import { sendReaction } from "../api/client.js";
import { getConnection } from "../lib/connection.js";

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

function typeIcon(type) {
  switch (type) {
    case "markdown": return "\uD83D\uDCC4";
    case "pdf": return "\uD83D\uDCCA";
    case "audio": return "\uD83C\uDFB5";
    case "video": return "\uD83C\uDFAC";
    case "data": return "\uD83D\uDDC2\uFE0F";
    case "text": return "\uD83D\uDCC4";
    default: return "\uD83D\uDCC1";
  }
}

function authUrl(url) {
  const conn = getConnection();
  if (!conn) return url;
  const sep = url.includes("?") ? "&" : "?";
  return conn.serverUrl + url + sep + "token=" + conn.apiKey;
}

export default function FeedItem({ item, onOpenReceipt }) {
  const [expanded, setExpanded] = useState(false);
  const storageKey = `reaction:${item.id}`;
  const stored = localStorage.getItem(storageKey);
  const [reaction, setReaction] = useState(stored);
  const [sent, setSent] = useState(!!stored);

  function handleClick() {
    if (item.content_id && onOpenReceipt) {
      onOpenReceipt(item.content_id);
    } else {
      setExpanded(!expanded);
    }
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
    // Pre-load image to get natural dimensions before opening
    const srcs = images.map((att) => authUrl(att.url));
    const items = images.map((att) => ({ src: authUrl(att.url), alt: att.label, w: 800, h: 600 }));

    const img = new Image();
    img.src = srcs[index];
    const open = (w, h) => {
      items[index].w = w;
      items[index].h = h;
      const lightbox = new PhotoSwipeLightbox({
        dataSource: items,
        pswpModule: () => import("photoswipe"),
        bgOpacity: 0.9,
        pinchToClose: true,
      });
      // Fix dimensions for other slides as they load
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
    <article className="feed-item" onClick={handleClick}>
      <div className="feed-item-header">
        <span className="feed-item-dot" style={{ backgroundColor: item.workspace_color }} />
        <span className="feed-item-workspace">{item.workspace_name}</span>
        <span className="feed-item-time">{timeAgo(item.timestamp)}</span>
      </div>
      <h3 className="feed-item-title">{item.title}</h3>
      <div className={`feed-item-body ${expanded ? "expanded" : ""}`}>
        <Markdown rehypePlugins={[rehypeRaw]}>{item.body}</Markdown>
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
              onClick={(e) => { e.stopPropagation(); openLightbox(i); }}
            />
          ))}
        </div>
      )}
      {audioFiles.length > 0 && (
        <div className="feed-item-audio-list">
          {audioFiles.map((att, i) => (
            <div key={i} className="feed-item-audio">
              <span className="feed-item-audio-label">{att.label}</span>
              <audio
                controls
                preload="none"
                src={authUrl(att.url)}
                onClick={(e) => e.stopPropagation()}
              />
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
              onClick={(e) => e.stopPropagation()}
            >
              <span className="file-chip-icon">{typeIcon(att.type)}</span>
              <span className="file-chip-label">{att.label}</span>
              {att.size != null && (
                <span className="file-chip-size">{formatSize(att.size)}</span>
              )}
            </a>
          ))}
        </div>
      )}
      {placeholders.length > 0 && (
        <div className="feed-item-images">
          {placeholders.map((att, i) => (
            <div key={i} className="feed-item-image-placeholder">
              {att.label}
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div className="feed-item-actions">
          {sent ? (
            <span className="action-confirmed">
              {reaction === "up" ? "\uD83D\uDC4D" : "\uD83D\uDC4E"} Thanks for your feedback!
            </span>
          ) : (
            <>
              <button
                className="action-btn"
                onClick={(e) => handleReaction("up", e)}
              >
                <span role="img" aria-label="thumbs up">&#x1F44D;</span>
              </button>
              <button
                className="action-btn"
                onClick={(e) => handleReaction("down", e)}
              >
                <span role="img" aria-label="thumbs down">&#x1F44E;</span>
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
