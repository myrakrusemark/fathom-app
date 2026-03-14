import { useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";

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
  const [reaction, setReaction] = useState(null);

  function handleClick() {
    if (item.content_id && onOpenReceipt) {
      onOpenReceipt(item.content_id);
    } else {
      setExpanded(!expanded);
    }
  }

  function handleReaction(type, e) {
    e.stopPropagation();
    setReaction((prev) => (prev === type ? null : type));
  }

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
      {item.images && item.images.length > 0 && (
        <div className="feed-item-images">
          {item.images.map((img, i) => (
            <div key={i} className="feed-item-image-placeholder">
              {img.alt}
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div className="feed-item-actions">
          <button
            className={`action-btn ${reaction === "up" ? "active" : ""}`}
            onClick={(e) => handleReaction("up", e)}
          >
            <span role="img" aria-label="thumbs up">&#x1F44D;</span>
          </button>
          <button
            className={`action-btn ${reaction === "down" ? "active" : ""}`}
            onClick={(e) => handleReaction("down", e)}
          >
            <span role="img" aria-label="thumbs down">&#x1F44E;</span>
          </button>
        </div>
      )}
    </article>
  );
}
