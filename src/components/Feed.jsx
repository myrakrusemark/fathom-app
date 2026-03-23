import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MessageCircle, ChevronDown, Image } from "lucide-react";
import { getFeed, listRooms, dismissFeedItem, fireRoutine } from "../api/client.js";
import { getHumanUser } from "../lib/connection.js";
import FeedItem from "./FeedItem.jsx";
import FeedDetailPanel from "./FeedDetailPanel.jsx";
import FeedEmpty from "./FeedEmpty.jsx";
import WallpaperPanel from "./WallpaperPanel.jsx";

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
  unreadCount = 0,
  wallpaper = null,
}) {
  const [allItems, setAllItems] = useState([]);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [unreadThreads, setUnreadThreads] = useState(new Set());
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const localDismissedRef = useRef(new Set());

  const handleDismiss = useCallback((itemId) => {
    // Track locally so poll can't overwrite with stale server data
    localDismissedRef.current.add(itemId);
    // Optimistically mark as dismissed in local state
    setAllItems((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId ? { ...item, dismissed: true } : item
      );
      // Fire Scout when the last undismissed card is dismissed
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

  // Stack computation — only recompute when newItems changes (not on every Feed render)
  const stackedNewItems = useMemo(() => stackByWorkspace(newItems), [newItems]);

  // Fetch feed data, poll every 30s
  useEffect(() => {
    let cancelled = false;
    let first = true;
    function fetchFeed() {
      if (first) { setLoading(true); first = false; }
      getFeed()
        .then((data) => {
          if (!cancelled) {
            // Merge server data with local dismissals to prevent stale
            // poll responses from overwriting optimistic dismiss state
            const items = (data.items || []).map((item) =>
              localDismissedRef.current.has(item.id)
                ? { ...item, dismissed: true }
                : item
            );
            setAllItems(items);
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
        {wallpaper?.reason && (
          <button className="tour-replay-btn" onClick={() => setWallpaperOpen(true)} aria-label="Wallpaper info">
            <Image size={16} />
          </button>
        )}

      </header>

      <>
          {unreadCount > 0 && (
            <div className="feed-unread-banner" role="button" tabIndex={0} onClick={onChatOpen} onKeyDown={(e) => e.key === "Enter" && onChatOpen()}>
              <MessageCircle size={16} />
              <span>{unreadCount} new {unreadCount === 1 ? "message" : "messages"} from fathom</span>
            </div>
          )}

          <div className="feed">
            {newItems.length === 0 && <FeedEmpty />}
            {stackedNewItems.map((entry, index) =>
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

          {wallpaperOpen && wallpaper && (
            <WallpaperPanel
              wallpaper={wallpaper}
              onClose={() => setWallpaperOpen(false)}
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
                  <ChevronDown
                    size={14}
                    className={`feed-earlier-chevron ${earlierOpen ? "open" : ""}`}
                  />
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
