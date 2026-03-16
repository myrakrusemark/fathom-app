import { useState, useEffect, useCallback, useMemo } from "react";
import { getFeed, getWeather, listRooms, dismissFeedItem } from "../api/client.js";
import { getInterestEntries } from "../data/workspaces.js";
import FeedItem from "./FeedItem.jsx";
import FeedDetailPanel from "./FeedDetailPanel.jsx";

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

function stackByWorkspace(items) {
  const result = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    const layout = item.layout || "standard";
    // Only stack standard/compact items from the same workspace
    if (layout === "standard" || layout === "compact") {
      const group = [item];
      while (
        i + 1 < items.length &&
        items[i + 1].workspace === item.workspace &&
        (items[i + 1].layout || "standard") !== "hero" &&
        (items[i + 1].layout || "standard") !== "featured"
      ) {
        i++;
        group.push(items[i]);
      }
      if (group.length > 2) {
        result.push({ stacked: true, items: group });
      } else {
        group.forEach((g) => result.push({ stacked: false, item: g }));
      }
    } else {
      result.push({ stacked: false, item });
    }
    i++;
  }
  return result;
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

// --- Atmosphere presets ---

const ATMOSPHERES = [
  { label: "Default", dot: "#a8c4e0", bg: "radial-gradient(ellipse at 30% 10%, rgba(180,210,240,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(190,215,240,0.3) 0%, transparent 50%), linear-gradient(180deg, #c4d7ea 0%, #d0dfed 25%, #dce7f0 50%, #e3eaf1 75%, #e0e6ee 100%)", text: "" },
  { label: "Sunny Day", dot: "#f59e0b", bg: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.25) 0%, transparent 50%), radial-gradient(ellipse at 70% 40%, rgba(254,249,195,0.2) 0%, transparent 40%), linear-gradient(180deg, #87CEEB 0%, #B0E0E6 20%, #e0ead8 50%, #d4d0c6 80%, #ccc8bf 100%)", text: "#3a3520" },
  { label: "Cloudy", dot: "#94a3b8", bg: "radial-gradient(ellipse at 30% 15%, rgba(255,255,255,0.5) 0%, transparent 35%), radial-gradient(ellipse at 70% 25%, rgba(203,213,225,0.4) 0%, transparent 40%), radial-gradient(ellipse at 50% 70%, rgba(226,232,240,0.3) 0%, transparent 50%), linear-gradient(180deg, #b4c0d4 0%, #cbd5e1 25%, #e2e8f0 50%, #dde1ea 75%, #d5d9e5 100%)", text: "" },
  { label: "Sunset", dot: "#e8855a", bg: "radial-gradient(ellipse at 60% 10%, rgba(255,180,100,0.35) 0%, transparent 45%), radial-gradient(ellipse at 30% 35%, rgba(240,140,120,0.25) 0%, transparent 45%), radial-gradient(ellipse at 65% 65%, rgba(200,120,160,0.2) 0%, transparent 40%), linear-gradient(180deg, #f5c77e 0%, #eda06a 15%, #e88565 30%, #d8707a 50%, #b86b8a 65%, #7a5080 82%, #3d2b52 100%)", text: "#3d2b52" },
  { label: "Rainy", dot: "#64748b", bg: "radial-gradient(ellipse at 40% 20%, rgba(148,163,184,0.3) 0%, transparent 45%), radial-gradient(ellipse at 70% 60%, rgba(100,116,139,0.2) 0%, transparent 50%), linear-gradient(180deg, #94a3b8 0%, #a8b5c5 20%, #b8c2ce 40%, #c4cdd6 60%, #bfc8d1 80%, #b0b8c2 100%)", text: "#1e293b" },
  { label: "Foggy", dot: "#d1d5db", bg: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.4) 0%, transparent 60%), linear-gradient(180deg, #d1d5db 0%, #dde0e4 20%, #e5e7eb 40%, #ebedf0 60%, #e8eaed 80%, #e2e4e7 100%)", text: "#6b7280" },
  { label: "Snowy", dot: "#e5e7eb", bg: "radial-gradient(ellipse at 40% 20%, rgba(255,255,255,0.6) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(219,234,254,0.3) 0%, transparent 40%), linear-gradient(180deg, #e0e5ec 0%, #ebeef3 20%, #f1f3f7 40%, #f5f7fa 60%, #eef1f5 80%, #e4e8ee 100%)", text: "#4b5563" },
  { label: "Night", dot: "#1e293b", bg: "radial-gradient(ellipse at 30% 20%, rgba(30,58,138,0.3) 0%, transparent 45%), radial-gradient(ellipse at 70% 50%, rgba(49,46,89,0.25) 0%, transparent 40%), linear-gradient(180deg, #0f172a 0%, #1e1b4b 20%, #1e293b 40%, #27344a 60%, #1e293b 80%, #0f172a 100%)", text: "#cbd5e1" },
];

function AtmosphereBar({ active, onSelect }) {
  return (
    <div className="atmosphere-bar">
      {ATMOSPHERES.map((a, i) => (
        <button
          key={a.label}
          className={`atmosphere-btn${active === i ? " active" : ""}`}
          onClick={() => onSelect(i)}
        >
          <span className="atmosphere-dot" style={{ background: a.dot }} />
          {a.label}
        </button>
      ))}
    </div>
  );
}

// --- Main Feed ---

export default function Feed({
  onChatOpen,
  onStartTour,
  feedMode = "lived",
  onToggleMode,
  userName,
  selectedInterests,
  unreadCount = 0,
}) {
  // Lived mode state
  const [allItems, setAllItems] = useState([]);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(feedMode !== "fresh");
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [atmosphere, setAtmosphere] = useState(0);
  const [unreadThreads, setUnreadThreads] = useState(new Set());

  // Apply atmosphere to body
  useEffect(() => {
    const a = ATMOSPHERES[atmosphere];
    document.body.style.background = a.bg;
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.color = a.text || "";
    document.documentElement.style.setProperty("--text", a.text || "#1a1a2e");
    return () => {
      document.body.style.background = "";
      document.body.style.backgroundAttachment = "";
      document.body.style.color = "";
      document.documentElement.style.setProperty("--text", "#1a1a2e");
    };
  }, [atmosphere]);

  const handleDismiss = useCallback((itemId) => {
    // Optimistically mark as dismissed in local state
    setAllItems((prev) => prev.map((item) =>
      item.id === itemId ? { ...item, dismissed: true } : item
    ));
    if (selectedItemId === itemId) setSelectedItemId(null);
    // Persist to server
    dismissFeedItem(itemId).catch(console.error);
  }, [selectedItemId]);

  // Split items into new (undismissed) and earlier (dismissed)
  const { newItems, earlierItems } = useMemo(() => {
    const n = [];
    const e = [];
    for (const item of allItems) {
      if (item.dismissed) {
        e.push(item);
      } else {
        n.push(item);
      }
    }
    return { newItems: n, earlierItems: e };
  }, [allItems]);

  // Resolve selected item from ID
  const selectedItem = useMemo(
    () => allItems.find((i) => i.id === selectedItemId) || null,
    [allItems, selectedItemId]
  );

  // Fresh mode animation phases: empty → welcome → setup → messages
  const [freshPhase, setFreshPhase] = useState("empty");

  // Build interest entries from selected interests
  const selectedEntries = getInterestEntries(selectedInterests);

  // Always fetch weather
  useEffect(() => {
    getWeather().then(setWeather).catch(() => {});
  }, []);

  // Fetch feed data when in lived mode, poll every 30s
  useEffect(() => {
    if (feedMode === "fresh") return;
    let cancelled = false;
    let first = true;
    function fetchFeed() {
      if (first) { setLoading(true); first = false; }
      getFeed()
        .then((data) => {
          if (!cancelled) {
            setAllItems(data.items || []);
          }
        })
        .catch(console.error)
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    fetchFeed();
    const interval = setInterval(fetchFeed, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [feedMode]);

  // Poll room list for unread thread indicators
  useEffect(() => {
    if (feedMode === "fresh") return;
    let cancelled = false;
    function fetchRooms() {
      listRooms("myra")
        .then((data) => {
          if (cancelled) return;
          const unread = new Set();
          for (const room of data.rooms || []) {
            if (room.name.startsWith("notif-") && room.unread_count > 0) {
              // notif-{workspace}-{itemId} — extract itemId (everything after second dash)
              const parts = room.name.split("-");
              if (parts.length >= 3) {
                const itemId = parts.slice(2).join("-");
                unread.add(itemId);
              }
            }
          }
          setUnreadThreads(unread);
        })
        .catch(() => {});
    }
    fetchRooms();
    const interval = setInterval(fetchRooms, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
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
          {isFresh ? "getting started" : "updates"}
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

      {!isFresh && <AtmosphereBar active={atmosphere} onSelect={setAtmosphere} />}

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
            {stackByWorkspace(newItems).map((entry) =>
              entry.stacked ? (
                <FeedItem key={entry.items[0].id} item={entry.items[0]} stackedItems={entry.items} unreadThreads={unreadThreads}onSelect={(item) => setSelectedItemId(item.id)} onDismiss={handleDismiss} />
              ) : (
                <FeedItem key={entry.item.id} item={entry.item} unreadThread={unreadThreads.has(entry.item.id)}onSelect={(item) => setSelectedItemId(item.id)} onDismiss={handleDismiss} />
              )
            )}
          </div>

          {selectedItem && (
            <FeedDetailPanel
              item={selectedItem}
              onClose={() => setSelectedItemId(null)}
              onDismiss={() => handleDismiss(selectedItem.id)}
            />
          )}

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
                  {earlierItems.map((item) => (
                    <FeedItem key={item.id} item={item}onSelect={(i) => setSelectedItemId(i.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
