import { useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
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

export default function FeedItem({ item, stackedItems, onOpenReceipt, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  // Stacked card — multiple same-workspace items in one cell
  if (stackedItems && stackedItems.length > 1) {
    const MAX_VISIBLE = 4;
    const visible = stackedItems.slice(0, MAX_VISIBLE);
    const remaining = stackedItems.length - MAX_VISIBLE;
    const shown = expanded ? stackedItems : visible;

    return (
      <article className="feed-item feed-item-stacked" tabIndex={0}>
        {shown.map((sub) => (
          <div
            key={sub.id}
            className="feed-stacked-row"
            onClick={() => onSelect?.(sub)}
            onKeyDown={(e) => { if (e.key === "Enter") onSelect?.(sub); }}
            tabIndex={0}
            role="button"
          >
            <h3 className="feed-stacked-title">{sub.title}</h3>
            <span className="feed-stacked-time">{timeAgo(sub.timestamp)}</span>
          </div>
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
        <div className="feed-item-footer">
          <span className="feed-item-dot" style={{ backgroundColor: item.workspace_color }} />
          <span className="feed-item-workspace">{item.workspace_name}</span>
          <span className="feed-item-time">{stackedItems.length} items</span>
        </div>
      </article>
    );
  }

  function handleClick() {
    if (item.content_id && onOpenReceipt) {
      onOpenReceipt(item);
    } else if (onSelect) {
      onSelect(item);
    }
  }

  const attachments = item.attachments || [];
  const firstImage = attachments.find((a) => a.type === "image" && !a.placeholder && a.url);

  return (
    <article
      className={`feed-item${item.layout ? ` layout-${item.layout}` : ""}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      tabIndex={0}
      role="button"
    >
      <h3 className="feed-item-title">{item.title}</h3>
      <div className="feed-item-body" onClick={(e) => { if (e.target.tagName === "A") e.stopPropagation(); }}>
        <Markdown rehypePlugins={[rehypeRaw]}>{item.body}</Markdown>
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
      <div className="feed-item-footer">
        <span className="feed-item-dot" style={{ backgroundColor: item.workspace_color }} />
        <span className="feed-item-workspace">{item.workspace_name}</span>
        {attachments.length > 0 && (
          <span className="feed-item-attachments">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            {attachments.length}
          </span>
        )}
        <span className="feed-item-time">{timeAgo(item.timestamp)}</span>
      </div>
    </article>
  );
}
