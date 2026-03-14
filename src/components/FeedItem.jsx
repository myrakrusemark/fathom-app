import { useState } from "react";

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

export default function FeedItem({ item, onOpenReceipt }) {
  const [expanded, setExpanded] = useState(false);

  function handleClick() {
    if (item.receipt_id && onOpenReceipt) {
      onOpenReceipt(item.receipt_id);
    } else {
      setExpanded(!expanded);
    }
  }

  return (
    <article className="feed-item" onClick={handleClick}>
      <div className="feed-item-header">
        <span className="feed-item-dot" style={{ backgroundColor: item.workspace_color }} />
        <span className="feed-item-workspace">{item.workspace_name}</span>
        <span className="feed-item-time">{timeAgo(item.timestamp)}</span>
      </div>
      <h3 className="feed-item-title">{item.title}</h3>
      <p className={`feed-item-body ${expanded ? "expanded" : ""}`}>
        {item.body}
      </p>
      {item.images && item.images.length > 0 && (
        <div className="feed-item-images">
          {item.images.map((img, i) => (
            <div key={i} className="feed-item-image-placeholder">
              {img.alt}
            </div>
          ))}
        </div>
      )}
      {item.actions && item.actions.length > 0 && expanded && (
        <div className="feed-item-actions">
          {item.actions.includes("approve") && (
            <button className="action-btn approve" onClick={(e) => e.stopPropagation()}>
              <span role="img" aria-label="approve">&#x1F44D;</span>
            </button>
          )}
          {item.actions.includes("reject") && (
            <button className="action-btn reject" onClick={(e) => e.stopPropagation()}>
              <span role="img" aria-label="reject">&#x1F44E;</span>
            </button>
          )}
          {item.actions.includes("more") && (
            <button className="action-btn more" onClick={(e) => e.stopPropagation()}>
              more like this
            </button>
          )}
          {item.actions.includes("expand") && (
            <button className="action-btn" onClick={(e) => e.stopPropagation()}>
              read full
            </button>
          )}
        </div>
      )}
    </article>
  );
}
