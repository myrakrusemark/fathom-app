import { useState, useRef, useCallback, useEffect } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { feedSanitizeSchema } from "../lib/sanitize.js";
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

function authUrl(url) {
  const conn = getConnection();
  if (!conn) return url;
  const sep = url.includes("?") ? "&" : "?";
  return conn.serverUrl + url + sep + "token=" + conn.apiKey;
}

const SWIPE_THRESHOLD = 100;
const ROW_SWIPE_THRESHOLD = 80;

function StackedRow({ sub, onSelect, onDismiss, unread }) {
  const rowRef = useRef(null);
  const startX = useRef(0);
  const dx = useRef(0);

  const handleTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX;
    dx.current = 0;
  }, []);

  const handleTouchMove = useCallback((e) => {
    dx.current = e.touches[0].clientX - startX.current;
    if (dx.current > 0 && rowRef.current) {
      rowRef.current.style.transform = `translateX(${dx.current}px)`;
      rowRef.current.style.opacity = String(Math.max(0, 1 - dx.current / 200));
    } else if (rowRef.current) {
      rowRef.current.style.transform = "translateX(0)";
      rowRef.current.style.opacity = "1";
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const el = rowRef.current;
    if (dx.current > ROW_SWIPE_THRESHOLD && onDismiss) {
      if (el) {
        el.style.transition = "transform 0.3s, opacity 0.3s";
        el.style.transform = "translateX(100%)";
        el.style.opacity = "0";
      }
      setTimeout(() => onDismiss(sub.id), 300);
    } else if (el) {
      el.style.transition = "transform 0.2s, opacity 0.2s";
      el.style.transform = "";
      el.style.opacity = "";
      setTimeout(() => { if (rowRef.current) rowRef.current.style.transition = ""; }, 200);
    }
  }, [onDismiss, sub.id]);

  return (
    <div
      ref={rowRef}
      className="feed-stacked-row"
      onClick={() => onSelect?.(sub)}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect?.(sub); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="button"
    >
      {unread && <span className="feed-item-unread-dot" />}
      <h3 className="feed-stacked-title">{sub.title}</h3>
      {sub.attachments?.length > 0 && (
        <span className="feed-stacked-attachments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          {sub.attachments.length}
        </span>
      )}
      <span className="feed-stacked-time">{timeAgo(sub.timestamp)}</span>
      {onDismiss && (
        <button
          className="feed-stacked-dismiss"
          onClick={(e) => { e.stopPropagation(); onDismiss(sub.id); }}
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function FeedItem({ item, stackedItems, unreadThread, unreadThreads, onSelect, onDismiss, showSwipeHint }) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef(null);
  const swipeStart = useRef(0);
  const swipeDx = useRef(0);
  const [hintClass, setHintClass] = useState("");

  useEffect(() => {
    if (!showSwipeHint) return;
    if (sessionStorage.getItem("swipe-hint-shown")) return;
    sessionStorage.setItem("swipe-hint-shown", "true");
    setHintClass("feed-item-swipe-hint");
    const timer = setTimeout(() => setHintClass(""), 1300);
    return () => clearTimeout(timer);
  }, [showSwipeHint]);

  const handleTouchStart = useCallback((e) => {
    swipeStart.current = e.touches[0].clientX;
    swipeDx.current = 0;
  }, []);

  const handleTouchMove = useCallback((e) => {
    swipeDx.current = e.touches[0].clientX - swipeStart.current;
    if (swipeDx.current > 0 && cardRef.current) {
      cardRef.current.style.transform = `translateX(${swipeDx.current}px)`;
      cardRef.current.style.opacity = String(Math.max(0, 1 - swipeDx.current / 300));
    } else if (cardRef.current) {
      cardRef.current.style.transform = "translateX(0)";
      cardRef.current.style.opacity = "1";
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const el = cardRef.current;
    if (swipeDx.current > SWIPE_THRESHOLD && onDismiss) {
      if (el) {
        el.style.transition = "transform 0.3s, opacity 0.3s";
        el.style.transform = "translateX(100%)";
        el.style.opacity = "0";
      }
      setTimeout(() => onDismiss(item.id), 300);
    } else if (el) {
      el.style.transition = "transform 0.2s, opacity 0.2s";
      el.style.transform = "";
      el.style.opacity = "";
      setTimeout(() => { if (cardRef.current) cardRef.current.style.transition = ""; }, 200);
    }
  }, [onDismiss, item.id]);

  // Stacked card — multiple same-workspace items in one cell
  if (stackedItems && stackedItems.length > 1) {
    const MAX_VISIBLE = 4;
    const visible = stackedItems.slice(0, MAX_VISIBLE);
    const remaining = stackedItems.length - MAX_VISIBLE;
    const shown = expanded ? stackedItems : visible;

    return (
      <article className="feed-item feed-item-stacked" tabIndex={0}>
        {shown.map((sub) => (
          <StackedRow key={sub.id} sub={sub} onSelect={onSelect} onDismiss={onDismiss} unread={unreadThreads?.has(sub.id)} />
        ))}
        {remaining > 0 && !expanded && (
          <div
            className="feed-stacked-row feed-stacked-more"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") setExpanded(true); }}
          >
            <span className="feed-stacked-more-label">+ {remaining} more</span>
          </div>
        )}
        {remaining > 0 && expanded && (
          <div
            className="feed-stacked-row feed-stacked-more"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") setExpanded(false); }}
          >
            <span className="feed-stacked-more-label">show less</span>
          </div>
        )}
        <div className="feed-item-footer" style={{ background: `${item.workspace_color}25` }}>
          <span className="feed-item-workspace">{item.workspace_name}</span>
          <span className="feed-item-time">{item.layout || "standard"} · {stackedItems.length} items</span>
        </div>
      </article>
    );
  }

  function handleClick() {
    if (onSelect) {
      onSelect(item);
    }
  }

  const attachments = item.attachments || [];
  const firstImage = attachments.find((a) => a.type === "image" && !a.placeholder && a.url);

  return (
    <article
      ref={cardRef}
      className={`feed-item${item.layout ? ` layout-${item.layout}` : ""}${hintClass ? ` ${hintClass}` : ""}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="button"
    >
      {onDismiss && (
        <button
          className="feed-item-dismiss"
          onClick={(e) => { e.stopPropagation(); onDismiss(item.id); }}
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
      <h3 className="feed-item-title">
        {unreadThread && <span className="feed-item-unread-dot" />}
        {item.title}
      </h3>
      <div className="feed-item-body" onClick={(e) => { if (e.target.tagName === "A") e.stopPropagation(); }}>
        <Markdown rehypePlugins={[rehypeRaw, [rehypeSanitize, feedSanitizeSchema]]}>{item.body}</Markdown>
      </div>
      {firstImage && (
        <div className="feed-item-images">
          <img
            className="feed-item-image"
            src={authUrl(firstImage.url)}
            alt={firstImage.label}
            loading="lazy"
          />
        </div>
      )}
      <div className="feed-item-footer" style={{ background: `${item.workspace_color}25` }}>
        <span className="feed-item-workspace">{item.workspace_name}</span>
        {attachments.length > 0 && (
          <span className="feed-item-attachments">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            {attachments.length}
          </span>
        )}
        <span className="feed-item-time">{item.layout || "standard"} · {timeAgo(item.timestamp)}</span>
      </div>
    </article>
  );
}
