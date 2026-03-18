import { useState, useEffect } from "react";
import { getSuggestions, postToRoom } from "../api/client.js";
import { getHumanUser, getHumanDisplayName } from "../lib/connection.js";

const SCOUT_CURATE_ROUTINE_ID = "scout-curate";

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

function ScoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" width="28" height="28">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export default function FeedEmpty() {
  const [suggestions, setSuggestions] = useState([]);
  const [customText, setCustomText] = useState("");
  const [phase, setPhase] = useState("browse"); // "browse" | "sending" | "confirmed"

  useEffect(() => {
    getSuggestions()
      .then((data) => {
        if (Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, []);

  function sendToScout(message) {
    setPhase("sending");
    // Post DM so Scout has the request (Scout is already running from useEffect fire)
    const human = getHumanUser();
    postToRoom(`dm:${[human, "scout"].sort().join("+")}`, message)
      .then(() => setPhase("confirmed"))
      .catch(() => setPhase("confirmed")); // show confirmation even on error
  }

  function handlePick(suggestion) {
    sendToScout(
      `[APP REQUEST] ${getHumanDisplayName()} picked: "${suggestion.title}". ` +
      `DO NOT reply to this DM — she won't see it. ` +
      `Follow up by posting a #notification (featured layout) with your plan or clarifying questions. See CLAUDE.md § Route Requests.`
    );
  }

  function handleCustom(e) {
    e.preventDefault();
    if (!customText.trim()) return;
    sendToScout(
      `[APP REQUEST] ${getHumanDisplayName()} wants: ${customText.trim()}. ` +
      `DO NOT reply to this DM — she won't see it. ` +
      `Follow up by posting a #notification (featured layout) with your plan or clarifying questions. See CLAUDE.md § Route Requests.`
    );
  }

  // Confirmed state — Scout is on it
  if (phase === "confirmed") {
    return (
      <div className="feed-empty feed-empty-confirmed">
        <div className="feed-empty-scout-icon">
          <ScoutIcon />
        </div>
        <div className="feed-empty-bubble">
          Thanks! Watch your feed for updates.
        </div>
      </div>
    );
  }

  // Sending state — brief transition
  if (phase === "sending") {
    return (
      <div className="feed-empty feed-empty-sending">
        <div className="feed-empty-icon">
          <PlusCircle />
        </div>
        <p className="feed-empty-subtitle">Sending to Scout...</p>
      </div>
    );
  }

  // Browse state — show suggestions
  return (
    <div className="feed-empty">
      <div className="feed-empty-icon">
        <PlusCircle />
      </div>
      <h2 className="feed-empty-title">All caught up</h2>
      <p className="feed-empty-subtitle">
        I found some things worth starting
      </p>

      {suggestions.length > 0 && (
        <div className="feed-empty-suggestions">
          {suggestions.map((s) => (
            <button
              key={s.title}
              className="feed-empty-card"
              onClick={() => handlePick(s)}
            >
              {s.emoji && <span className="feed-empty-card-emoji">{s.emoji}</span>}
              <span className="feed-empty-card-text">{s.title}</span>
            </button>
          ))}
        </div>
      )}

      <form className="feed-empty-input" onSubmit={handleCustom}>
        <input
          type="text"
          placeholder="Or tell me what you need..."
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
        />
        <button
          type="submit"
          className="feed-empty-send"
          disabled={!customText.trim()}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
