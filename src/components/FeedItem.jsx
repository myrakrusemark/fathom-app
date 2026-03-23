import { useState, useRef, useCallback, useEffect } from "react";
import { Paperclip, X } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { feedSanitizeSchema } from "../lib/sanitize.js";
import { timeAgo, authUrl } from "../lib/formatters.js";

const SWIPE_THRESHOLD = 100;
const ROW_SWIPE_THRESHOLD = 80;
const SWIPE_OPACITY_RANGE = 300;   // px over which card fades while swiping
const ROW_OPACITY_RANGE = 200;     // px over which row fades while swiping
const DISMISS_DELAY_MS = 300;      // wait for swipe-out animation before calling onDismiss
const RESET_TRANSITION_MS = 200;   // wait before clearing CSS transition after snap-back
const SWIPE_HINT_MS = 1300;        // how long the swipe-hint animation plays on first load

function StackedRow({ sub, onSelect, onDismiss, unread }) {
  const rowRef = useRef(null);
  const startX = useRef(0);
  const dx = useRef(0);

  const handleTouchStart = useCallback((e) => {
    if (rowRef.current) rowRef.current.style.transition = "";
    startX.current = e.touches[0].clientX;
    dx.current = 0;
  }, []);

  const handleTouchMove = useCallback((e) => {
    dx.current = e.touches[0].clientX - startX.current;
    if (dx.current > 0 && rowRef.current) {
      rowRef.current.style.transform = `translateX(${dx.current}px)`;
      rowRef.current.style.opacity = String(Math.max(0, 1 - dx.current / ROW_OPACITY_RANGE));
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
      setTimeout(() => onDismiss(sub.id), DISMISS_DELAY_MS);
    } else if (el) {
      el.style.transition = "transform 0.2s, opacity 0.2s";
      el.style.transform = "";
      el.style.opacity = "";
      setTimeout(() => { if (rowRef.current) rowRef.current.style.transition = ""; }, RESET_TRANSITION_MS);
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
          <Paperclip size={11} />
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
          <X size={12} />
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time animation trigger; cleared by timeout, not external state
    setHintClass("feed-item-swipe-hint");
    const timer = setTimeout(() => setHintClass(""), SWIPE_HINT_MS);
    return () => clearTimeout(timer);
  }, [showSwipeHint]);

  const handleTouchStart = useCallback((e) => {
    if (cardRef.current) cardRef.current.style.transition = "";
    swipeStart.current = e.touches[0].clientX;
    swipeDx.current = 0;
  }, []);

  const handleTouchMove = useCallback((e) => {
    swipeDx.current = e.touches[0].clientX - swipeStart.current;
    if (swipeDx.current > 0 && cardRef.current) {
      cardRef.current.style.transform = `translateX(${swipeDx.current}px)`;
      cardRef.current.style.opacity = String(Math.max(0, 1 - swipeDx.current / SWIPE_OPACITY_RANGE));
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
      setTimeout(() => onDismiss(item.id), DISMISS_DELAY_MS);
    } else if (el) {
      el.style.transition = "transform 0.2s, opacity 0.2s";
      el.style.transform = "";
      el.style.opacity = "";
      setTimeout(() => { if (cardRef.current) cardRef.current.style.transition = ""; }, RESET_TRANSITION_MS);
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
          <X size={14} />
        </button>
      )}
      <h3 className="feed-item-title">
        {unreadThread && <span className="feed-item-unread-dot" />}
        {item.title}
      </h3>
      <div className="feed-item-body" onClick={(e) => { if (e.target.tagName === "A") e.stopPropagation(); }}>
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, feedSanitizeSchema]]}>{item.body}</Markdown>
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
            <Paperclip size={12} />
            {attachments.length}
          </span>
        )}
        <span className="feed-item-time">{item.layout || "standard"} · {timeAgo(item.timestamp)}</span>
      </div>
    </article>
  );
}
