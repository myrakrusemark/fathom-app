import { useState, useEffect, useCallback } from "react";
import { Send, PlusCircle as PlusCircleIcon, Clock, Newspaper, TrendingUp, ShoppingBag, FileText, Sun, RefreshCw } from "lucide-react";
import { readRoom, postToRoom, fireRoutine } from "../api/client.js";
import { getHumanUser, getHumanDisplayName } from "../lib/connection.js";

const ICON_MAP = {
  "📰": Newspaper, "📈": TrendingUp, "🛍️": ShoppingBag, "🛍": ShoppingBag,
  "📝": FileText, "☀️": Sun,
};

const DEFAULT_SUGGESTIONS = [
  { emoji: "📰", title: "Set up a daily news briefing" },
  { emoji: "📈", title: "Track a stock or market" },
  { emoji: "🛍️", title: "Find something to buy" },
  { emoji: "📝", title: "Research a topic for me" },
  { emoji: "☀️", title: "Set up weather alerts" },
];

function PlusCircle() {
  return <PlusCircleIcon size={48} color="var(--accent)" strokeWidth={1.5} />;
}

function SendIcon() {
  return <Send size={18} />;
}

function ScoutIcon() {
  return <Clock size={28} color="var(--accent)" strokeWidth={1.5} />;
}

export default function FeedEmpty({ hasNotifications = false }) {
  const [suggestions, setSuggestions] = useState([]);
  const [customText, setCustomText] = useState("");
  const [phase, setPhase] = useState("browse"); // "browse" | "sending" | "confirmed"
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSuggestions = useCallback(() => {
    // Read latest suggestions from #suggestions room (7 day window)
    return readRoom("suggestions", 10080)
      .then((data) => {
        const messages = data.messages || [];
        for (let i = messages.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(messages[i].message);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSuggestions(parsed);
              return;
            }
          } catch { /* not JSON, skip */ }
        }
        setSuggestions(DEFAULT_SUGGESTIONS);
      })
      .catch(() => setSuggestions(DEFAULT_SUGGESTIONS));
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  function handleRefresh() {
    setIsRefreshing(true);
    fireRoutine("56da7f53")
      .catch(() => {}) // fire-and-forget
      .finally(() => {
        // Poll for new suggestions — Scout needs a moment to run
        setTimeout(() => {
          fetchSuggestions().finally(() => setIsRefreshing(false));
        }, 4000);
      });
  }

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
      {!hasNotifications && (
        <>
          <div className="feed-empty-icon">
            <PlusCircle />
          </div>
          <h2 className="feed-empty-title">All caught up</h2>
          <p className="feed-empty-subtitle">
            I found some things worth starting
          </p>
        </>
      )}

      {suggestions.length > 0 && (
        <div className="feed-empty-suggestions">
          <button
            className={`feed-empty-refresh${isRefreshing ? " spinning" : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Ask Scout for fresh suggestions"
          >
            <RefreshCw size={14} />
          </button>
          {suggestions.map((s) => (
            <button
              key={s.title}
              className="feed-empty-card"
              onClick={() => handlePick(s)}
            >
              {s.emoji && <span className="feed-empty-card-emoji">{ICON_MAP[s.emoji] ? (() => { const Icon = ICON_MAP[s.emoji]; return <Icon size={18} />; })() : s.emoji}</span>}
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
