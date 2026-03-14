import { useState, useEffect } from "react";
import { getFeed, getWeather } from "../api/client.js";
import { getInterestEntries } from "../data/workspaces.js";
import FeedItem from "./FeedItem.jsx";

function WeatherIcon({ icon }) {
  if (icon === "cloud-sun") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 17a4.5 4.5 0 00-8.94-.5A3 3 0 006 19.5h11a2.5 2.5 0 00.5-5z" fill="rgba(255,255,255,0.4)" stroke="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M19 16.9A5 5 0 0018 7h-1.26a8 8 0 10-11.62 9" />
    </svg>
  );
}

function groupByWorkspace(items) {
  const groups = new Map();
  const order = [];
  for (const item of items) {
    if (!groups.has(item.workspace)) {
      groups.set(item.workspace, []);
      order.push(item.workspace);
    }
    groups.get(item.workspace).push(item);
  }
  return order.map((ws) => groups.get(ws));
}

function renderGroups(groups, onOpenReceipt) {
  return groups.map((group) =>
    group.length > 1 ? (
      <div className="feed-cluster" key={group[0].workspace}>
        {group.map((item) => (
          <FeedItem key={item.id} item={item} onOpenReceipt={onOpenReceipt} />
        ))}
      </div>
    ) : (
      <FeedItem key={group[0].id} item={group[0]} onOpenReceipt={onOpenReceipt} />
    )
  );
}

// --- Fresh feed sub-components ---

function WelcomeBubble({ userName, visible }) {
  if (!visible) return null;
  return (
    <div className="feed-item onboard-fade-in">
      <div className="feed-item-header">
        <span className="feed-item-dot" style={{ color: "#6366f1", background: "#6366f1" }} />
        <span className="feed-item-workspace">fathom</span>
        <span className="feed-item-time">just now</span>
      </div>
      <div className="feed-item-body" style={{ WebkitLineClamp: "unset", overflow: "visible" }}>
        Hey {userName}! Welcome to your feed. Updates from your workspaces and
        routines show up here. Here's what I set up for you...
      </div>
    </div>
  );
}

function SetupCard({ entry, isWorkspace }) {
  return (
    <div className="feed-setup-card">
      <span className="feed-setup-dot" style={{ background: entry.color }} />
      <span className="feed-setup-text">
        {isWorkspace ? "Workspace created" : "Routine added"}:{" "}
        <strong>{entry.displayName}</strong>
      </span>
    </div>
  );
}

function FreshFeedItem({ entry }) {
  const workspace = entry.createsWorkspace
    ? entry.workspaceId
    : "fathom";
  return (
    <div className="feed-item feed-fresh-item">
      <div className="feed-item-header">
        <span className="feed-item-dot" style={{ color: entry.color, background: entry.color }} />
        <span className="feed-item-workspace">{workspace}</span>
        <span className="feed-item-time">just now</span>
      </div>
      <div className="feed-item-body">{entry.welcomeMessage}</div>
    </div>
  );
}

// --- Toggle icon components ---

function SeedlingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M12 22V10" />
      <path d="M6 14c0-3.31 2.69-6 6-6 3.31 0 6 2.69 6 6" />
      <path d="M12 10c0-4 3-7 7-7-4 0-7 3-7 7z" />
      <path d="M12 10c0-4-3-7-7-7 4 0 7 3 7 7z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

// --- Main Feed ---

export default function Feed({
  onChatOpen,
  onOpenReceipt,
  onStartTour,
  feedMode = "lived",
  onToggleMode,
  userName,
  selectedInterests,
  unreadCount = 0,
}) {
  // Lived mode state
  const [newItems, setNewItems] = useState([]);
  const [earlierItems, setEarlierItems] = useState([]);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(feedMode !== "fresh");

  // Fresh mode animation phases: empty → welcome → setup → messages
  const [freshPhase, setFreshPhase] = useState("empty");

  // Build interest entries from selected interests
  const selectedEntries = getInterestEntries(selectedInterests);

  // Always fetch weather
  useEffect(() => {
    getWeather().then(setWeather).catch(() => {});
  }, []);

  // Fetch feed data when in lived mode
  useEffect(() => {
    if (feedMode === "fresh") return;
    let cancelled = false;
    setLoading(true);
    getFeed()
      .then((data) => {
        if (!cancelled) {
          setNewItems(data.items);
          setEarlierItems(data.earlier || []);
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [feedMode]);

  // Fresh mode: how many welcome messages have been revealed
  const [revealedMessages, setRevealedMessages] = useState(0);

  // Staged animation for fresh mode
  useEffect(() => {
    if (feedMode !== "fresh") return;
    setFreshPhase("empty"); // eslint-disable-line react-hooks/set-state-in-effect -- intentional reset on mode entry
    // 1s pause, then fathom's welcome notification
    const t1 = setTimeout(() => setFreshPhase("welcome"), 1000);
    // 5s to read it, then setup cards
    const t2 = setTimeout(() => setFreshPhase("setup"), 6000);
    // 1s after setup cards, start staggering welcome messages
    const t3 = setTimeout(() => setFreshPhase("messages"), 7000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [feedMode]);

  // Stagger individual welcome messages 2s apart, then show banner
  useEffect(() => {
    if (freshPhase !== "messages") return;
    // All messages revealed (or none to show) — wait 2s, show banner
    if (revealedMessages >= selectedEntries.length) {
      const t = setTimeout(() => setFreshPhase("banner"), 2000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setRevealedMessages((n) => n + 1),
      revealedMessages === 0 ? 0 : 2000
    );
    return () => clearTimeout(t);
  }, [freshPhase, revealedMessages, selectedEntries.length]);

  const isFresh = feedMode === "fresh";

  if (loading && !isFresh) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>fathom</h1>
        </header>
        <div className="loading">loading...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>fathom</h1>
        <span className="header-subtitle">
          {isFresh ? "getting started" : "what happened"}
        </span>
        {weather && (
          <div className="weather-pill">
            <WeatherIcon icon={weather.icon} />
            <span className="weather-temp">{weather.temp}°</span>
          </div>
        )}
        {onToggleMode && (
          <button
            className="feed-mode-toggle"
            onClick={onToggleMode}
            aria-label={isFresh ? "Show lived feed" : "Show first-landing feed"}
            title={isFresh ? "Switch to lived view" : "Switch to fresh view"}
          >
            {isFresh ? <ListIcon /> : <SeedlingIcon />}
          </button>
        )}
        <button className="tour-replay-btn" onClick={onStartTour} aria-label="Tour">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </header>

      {isFresh ? (
        <>
          {freshPhase === "banner" && (
            <div className="feed-unread-banner onboard-fade-in" onClick={onChatOpen}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>1 new message from fathom</span>
            </div>
          )}

          <div className="feed">
            <WelcomeBubble
              userName={userName || "there"}
              visible={freshPhase !== "empty"}
            />

            {["setup", "messages", "banner"].includes(freshPhase) &&
              selectedEntries.length > 0 && (
                <div className="feed-setup-group onboard-fade-in">
                  {selectedEntries.map((entry) => (
                    <SetupCard
                      key={entry.id}
                      entry={entry}
                      isWorkspace={entry.createsWorkspace}
                    />
                  ))}
                </div>
              )}

            {["messages", "banner"].includes(freshPhase) &&
              selectedEntries.slice(0, revealedMessages).map((entry) => (
                <FreshFeedItem key={entry.id} entry={entry} />
              ))}
          </div>
        </>
      ) : (
        <>
          {unreadCount > 0 && (
            <div className="feed-unread-banner" onClick={onChatOpen}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{unreadCount} new {unreadCount === 1 ? "message" : "messages"} from fathom</span>
            </div>
          )}

          <div className="feed">
            {renderGroups(groupByWorkspace(newItems), onOpenReceipt)}
          </div>

          {earlierItems.length > 0 && (
            <div className="feed-earlier">
              <button
                className="feed-earlier-toggle"
                onClick={() => setEarlierOpen(!earlierOpen)}
              >
                <span className="feed-earlier-label">
                  Earlier · {earlierItems.length}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="14"
                    height="14"
                    className={`feed-earlier-chevron ${earlierOpen ? "open" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              {earlierOpen && (
                <div className="feed feed-earlier-items">
                  {renderGroups(groupByWorkspace(earlierItems), onOpenReceipt)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
