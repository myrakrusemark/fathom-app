import { useState, useEffect } from "react";
import { getSuggestions, postToRoom } from "../api/client.js";

function PlusCircle() {
  return (
    <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
      <circle cx="32" cy="32" r="30" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="4 3" />
      <path d="M32 20v24M20 32h24" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

export default function FeedEmpty() {
  const [suggestions, setSuggestions] = useState([]);
  const [customText, setCustomText] = useState("");
  const [sending, setSending] = useState(null); // title or "custom"
  const [sent, setSent] = useState(null);

  useEffect(() => {
    getSuggestions()
      .then((data) => {
        if (Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, []);

  function handlePick(suggestion) {
    setSending(suggestion.title);
    postToRoom(
      "dm:myra+scout",
      `Myra picked: "${suggestion.title}"`,
      "myra"
    )
      .then(() => {
        setSent(suggestion.title);
        setSending(null);
      })
      .catch(() => setSending(null));
  }

  function handleCustom(e) {
    e.preventDefault();
    if (!customText.trim()) return;
    setSending("custom");
    postToRoom(
      "dm:myra+scout",
      `Myra wants: ${customText.trim()}`,
      "myra"
    )
      .then(() => {
        setSent("custom");
        setSending(null);
        setCustomText("");
      })
      .catch(() => setSending(null));
  }

  return (
    <div className="feed-empty">
      <div className="feed-empty-icon">
        <PlusCircle />
      </div>
      <h2 className="feed-empty-title">Nobody likes an empty feed!</h2>
      <p className="feed-empty-subtitle">
        Here are some things you might be into right now
      </p>

      {suggestions.length > 0 && (
        <div className="feed-empty-suggestions">
          {suggestions.map((s) => (
            <button
              key={s.title}
              className={`feed-empty-card${sent === s.title ? " sent" : ""}`}
              onClick={() => handlePick(s)}
              disabled={sending !== null}
            >
              {s.emoji && <span className="feed-empty-card-emoji">{s.emoji}</span>}
              <span className="feed-empty-card-text">{s.title}</span>
              {sent === s.title && <span className="feed-empty-card-check">&#10003;</span>}
            </button>
          ))}
        </div>
      )}

      <form className="feed-empty-input" onSubmit={handleCustom}>
        <input
          type="text"
          placeholder="Or type something specific..."
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          disabled={sending !== null}
        />
        <button
          type="submit"
          className="feed-empty-send"
          disabled={!customText.trim() || sending !== null}
        >
          {sent === "custom" ? "\u2713" : <SendIcon />}
        </button>
      </form>
    </div>
  );
}
