import { useState, useEffect, useCallback, useMemo } from "react";
import { getFeed, getWeather, listRooms, dismissFeedItem, fireRoutine } from "../api/client.js";
import { getHumanUser } from "../lib/connection.js";
import FeedItem from "./FeedItem.jsx";
import FeedDetailPanel from "./FeedDetailPanel.jsx";
import FeedEmpty from "./FeedEmpty.jsx";

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

// --- Main Feed ---

export default function Feed({
  onChatOpen,
  onStartTour,
  unreadCount = 0,
}) {
  const [allItems, setAllItems] = useState([]);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [unreadThreads, setUnreadThreads] = useState(new Set());

  const handleDismiss = useCallback((itemId) => {
    // Optimistically mark as dismissed in local state
    setAllItems((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId ? { ...item, dismissed: true } : item
      );
      // Fire Scout when the last undismissed card is swiped
      const remaining = updated.filter((item) => !item.dismissed);
      if (remaining.length === 0) {
        fireRoutine("scout-curate").catch(() => {});
      }
      return updated;
    });
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

  // Always fetch weather
  useEffect(() => {
    getWeather().then(setWeather).catch(() => {});
  }, []);

  // Fetch feed data, poll every 30s
  useEffect(() => {
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
  }, []);

  // Poll room list for unread thread indicators
  useEffect(() => {
    let cancelled = false;
    function fetchRooms() {
      listRooms(getHumanUser())
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
  }, []);

  if (loading) {
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
        <span className="header-subtitle">updates</span>
        {weather && (
          <div className="weather-pill">
            <WeatherIcon icon={weather.icon} />
            <span className="weather-temp">{weather.temp}°</span>
          </div>
        )}
        <button className="tour-replay-btn" onClick={onStartTour} aria-label="Tour">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </header>

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
            {newItems.length === 0 && <FeedEmpty />}
            {stackByWorkspace(newItems).map((entry, index) =>
              entry.stacked ? (
                <FeedItem key={entry.items[0].id} item={entry.items[0]} stackedItems={entry.items} unreadThreads={unreadThreads}onSelect={(item) => setSelectedItemId(item.id)} onDismiss={handleDismiss} />
              ) : (
                <FeedItem key={entry.item.id} item={entry.item} unreadThread={unreadThreads.has(entry.item.id)}onSelect={(item) => setSelectedItemId(item.id)} onDismiss={handleDismiss} showSwipeHint={index === 0} />
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
    </div>
  );
}
