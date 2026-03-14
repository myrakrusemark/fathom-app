import { useState, useEffect, useRef } from "react";
import { getReceipt } from "../api/client.js";

export default function ReceiptDetail({ receiptId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (receiptId) {
      let cancelled = false;
      getReceipt(receiptId)
        .then((data) => { if (!cancelled) setReceipt(data); })
        .catch(console.error)
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
  }, [receiptId]);

  function handleBackdropClick(e) {
    if (e.target === sheetRef.current) {
      onClose();
    }
  }

  return (
    <div
      ref={sheetRef}
      className={`chat-sheet-backdrop ${receiptId ? "open" : ""}`}
      onClick={handleBackdropClick}
    >
      <div className={`chat-sheet ${receiptId ? "open" : ""}`}>
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
          ) : receipt && (
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
          )}
        </div>
      </div>
    </div>
  );
}
