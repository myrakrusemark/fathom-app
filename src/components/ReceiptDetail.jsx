import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getReceipt } from "../api/client.js";
import { getConnection } from "../lib/connection.js";

function authUrl(url) {
  const conn = getConnection();
  if (!conn) return url;
  const sep = url.includes("?") ? "&" : "?";
  return conn.serverUrl + url + sep + "token=" + conn.apiKey;
}

function ReceiptContent({ receipt }) {
  return (
    <div className="receipt-content">
      <div className="receipt-header">
        <h1 className="receipt-title">Your News</h1>
        <span className="receipt-date">{receipt.date} · {receipt.edition} edition</span>
      </div>

      <div className="receipt-weather">
        <span>☀ {receipt.weather}</span>
      </div>

      <div className="receipt-section-label">Tracked Stories</div>

      {receipt.tracked.map((story, i) => (
        <div key={i} className="receipt-story">
          <h2 className="receipt-story-name">
            {story.name}
            <span className="receipt-day-count">day {story.day}</span>
          </h2>
          {story.deltas.map((d, j) => (
            <div key={j} className="receipt-delta">
              <span className="receipt-arrow">→</span>
              <span>{d.text}</span>
              {d.source && (
                <a href={d.source} className="receipt-source" onClick={(e) => e.stopPropagation()}>source</a>
              )}
            </div>
          ))}
          {story.was_now && (
            <div className="receipt-was-now">↻ {story.was_now}</div>
          )}
          {story.confidence && (
            <div className="receipt-confidence">◔ Confidence: {story.confidence}</div>
          )}
        </div>
      ))}

      {receipt.unsolicited.length > 0 && (
        <>
          <div className="receipt-section-label">You didn't ask, but</div>
          {receipt.unsolicited.map((story, i) => (
            <div key={i} className="receipt-story unsolicited">
              <h2 className="receipt-story-name">{story.name}</h2>
              {story.deltas.map((d, j) => (
                <div key={j} className="receipt-delta">
                  <span className="receipt-arrow">→</span>
                  <span>{d.text}</span>
                  {d.source && (
                    <a href={d.source} className="receipt-source" onClick={(e) => e.stopPropagation()}>source</a>
                  )}
                </div>
              ))}
              {story.connects && (
                <div className="receipt-connects">↩ Connects to: {story.connects}</div>
              )}
            </div>
          ))}
        </>
      )}

      {receipt.no_change.length > 0 && (
        <div className="receipt-no-change">
          No change: {receipt.no_change.join(", ")}.
        </div>
      )}

      <div className="receipt-footer">
        Next check {receipt.next_check} · Reply to add or remove stories
      </div>
    </div>
  );
}

function DispatchContent({ item }) {
  const attachments = item.attachments || [];
  const images = attachments.filter((a) => a.type === "image" && !a.placeholder);
  const audioFiles = attachments.filter((a) => a.type === "audio");
  const files = attachments.filter((a) => a.type !== "image" && a.type !== "audio" && !a.placeholder);

  return (
    <div className="dispatch-content">
      <div className="dispatch-header">
        <span className="dispatch-workspace-dot" style={{ backgroundColor: item.workspace_color }} />
        <span className="dispatch-workspace">{item.workspace_name}</span>
      </div>
      <h2 className="dispatch-title">{item.title}</h2>
      <div className="dispatch-body">
        <Markdown rehypePlugins={[rehypeRaw]}>{item.body}</Markdown>
      </div>
      {images.length > 0 && (
        <div className="dispatch-images">
          {images.map((att, i) => (
            <img key={i} className="dispatch-image" src={authUrl(att.url)} alt={att.label} loading="lazy" />
          ))}
        </div>
      )}
      {audioFiles.length > 0 && (
        <div className="dispatch-audio-list">
          {audioFiles.map((att, i) => (
            <div key={i} className="dispatch-audio">
              <span className="dispatch-audio-label">{att.label}</span>
              <audio controls preload="none" src={authUrl(att.url)} />
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="dispatch-files">
          {files.map((att, i) => (
            <a
              key={i}
              className="feed-item-file-chip"
              href={authUrl(att.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="file-chip-label">{att.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReceiptDetail({ item, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!item) {
      setReceipt(null);
      setLoading(false);
      return;
    }
    if (item.content_id) {
      let cancelled = false;
      setLoading(true);
      getReceipt(item.content_id)
        .then((data) => { if (!cancelled) setReceipt(data); })
        .catch(() => { if (!cancelled) setReceipt(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
  }, [item]);

  function handleBackdropClick(e) {
    if (e.target === sheetRef.current) {
      onClose();
    }
  }

  const isOpen = !!item;

  return (
    <div
      ref={sheetRef}
      className={`chat-sheet-backdrop ${isOpen ? "open" : ""}`}
      onClick={handleBackdropClick}
    >
      <div className={`chat-sheet ${isOpen ? "open" : ""}`}>
        <div className="chat-sheet-handle" onClick={onClose}>
          <div className="handle-bar" />
        </div>
        <div className="chat-sheet-header">
          <span className="chat-sheet-title">dispatch</span>
          <button className="chat-sheet-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="chat-sheet-messages">
          {loading ? (
            <div className="loading">loading...</div>
          ) : receipt ? (
            <ReceiptContent receipt={receipt} />
          ) : item ? (
            <DispatchContent item={item} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
