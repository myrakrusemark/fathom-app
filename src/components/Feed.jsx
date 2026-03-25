import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MessageCircle, ChevronDown, Image } from "lucide-react";
import { getFeed, listRooms, dismissFeedItem, restoreFeedItem, fireRoutine } from "../api/client.js";
import { notify } from "../lib/notify.js";
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
  const [threadCounts, setThreadCounts] = useState(new Map()); // itemId → message_count
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const localDismissedRef = useRef(new Set());
  const knownItemIdsRef = useRef(null); // null = first load (skip notification)
  const pageRef = useRef(null);
  const pullDistanceRef = useRef(0);
  const pullStartYRef = useRef(0);
  const isPullingRef = useRef(false);

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

  // Fetch feed — extracted so pull-to-refresh can call it directly
  const fetchFeed = useCallback(() => {
    return getFeed()
      .then((data) => {
        // Merge server data with local dismissals to prevent stale
        // poll responses from overwriting optimistic dismiss state
        const items = (data.items || []).map((item) =>
          localDismissedRef.current.has(item.id)
            ? { ...item, dismissed: true }
            : item
        );
        // Notify for new undismissed items (skip first load)
        if (knownItemIdsRef.current !== null) {
          const fresh = items.filter(
            (item) => !item.dismissed && !knownItemIdsRef.current.has(item.id)
          );
          if (fresh.length === 1) {
            notify(fresh[0].title || fresh[0].workspace || "New update", {
              body: fresh[0].body?.replace(/<[^>]*>/g, "").slice(0, 120) || "",
              tag: "feed-" + fresh[0].id,
            });
          } else if (fresh.length > 1) {
            notify("Fathom", {
              body: `${fresh.length} new updates`,
              tag: "feed-batch",
            });
          }
        }
        knownItemIdsRef.current = new Set(items.map((i) => i.id));
        setAllItems(items);
        setInitialLoadDone(true);
      })
      .catch(console.error);
  }, []);

  // Initial fetch + 30s background poll
  useEffect(() => {
    let cancelled = false;
    fetchFeed().finally(() => { if (!cancelled) setLoading(false); });
    const interval = setInterval(() => { if (!cancelled) fetchFeed(); }, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [fetchFeed]);

  // Poll room list for unread thread indicators — 5s for near-realtime
  useEffect(() => {
    let cancelled = false;
    const humanUser = getHumanUser();
    function fetchRooms() {
      listRooms(humanUser)
        .then((data) => {
          if (cancelled) return;
          const unread = new Set();
          const counts = new Map();
          const restoreIds = [];
          for (const room of data.rooms || []) {
            if (!room.name.startsWith("notif-")) continue;
            // notif-{workspace}-{itemId} — extract itemId (everything after second dash)
            const parts = room.name.split("-");
            if (parts.length < 3) continue;
            const itemId = parts.slice(2).join("-");
            // Track thread message counts for all notif rooms
            if (room.message_count > 0) {
              counts.set(itemId, room.message_count);
            }
            // Only mark unread when workspace responded (not when user sent)
            if (room.unread_count > 0 && room.last_sender !== humanUser) {
              unread.add(itemId);
              restoreIds.push(itemId);
            }
          }
          setUnreadThreads(unread);
          setThreadCounts(counts);
          // Auto-restore dismissed items when workspace adds to the thread
          if (restoreIds.length > 0) {
            setAllItems((prev) => {
              let changed = false;
              const updated = prev.map((item) => {
                if (item.dismissed && restoreIds.includes(item.id)) {
                  changed = true;
                  localDismissedRef.current.delete(item.id);
                  return { ...item, dismissed: false };
                }
                return item;
              });
              if (changed) {
                // Persist restore to server
                for (const id of restoreIds) {
                  restoreFeedItem(id).catch(() => {});
                }
              }
              return changed ? updated : prev;
            });
          }
        })
        .catch(() => {});
    }
    fetchRooms();
    const interval = setInterval(fetchRooms, 5_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Pull-to-refresh: attach non-passive touchmove to page element
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    function onTouchStart(e) {
      if (page.scrollTop === 0) {
        pullStartYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      }
    }

    function onTouchMove(e) {
      if (!isPullingRef.current) return;
      const dy = e.touches[0].clientY - pullStartYRef.current;
      if (dy > 0) {
        e.preventDefault();
        const clamped = Math.min(dy * 0.5, 60); // dampen + cap at 60px
        pullDistanceRef.current = clamped;
        setPullDistance(clamped);
      }
    }

    function onTouchEnd() {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      if (pullDistanceRef.current >= 50) {
        setIsRefreshing(true);
        setPullDistance(0);
        fetchFeed().finally(() => setIsRefreshing(false));
      } else {
        setPullDistance(0);
      }
      pullDistanceRef.current = 0;
    }

    page.addEventListener("touchstart", onTouchStart, { passive: true });
    page.addEventListener("touchmove", onTouchMove, { passive: false });
    page.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      page.removeEventListener("touchstart", onTouchStart);
      page.removeEventListener("touchmove", onTouchMove);
      page.removeEventListener("touchend", onTouchEnd);
    };
  }, [fetchFeed]);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1><span className="c-teal">fa</span><span className="c-purple">th</span><span className="c-orange">o</span><span className="c-green">m</span></h1>
        </header>
        <div className="feed">
          {[1, 2, 3].map((i) => (
            <div key={i} className="feed-item feed-item-skeleton" aria-hidden="true">
              <div className="skeleton-title" />
              <div className="skeleton-body" />
              <div className="skeleton-body skeleton-body-short" />
              <div className="skeleton-footer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page" ref={pageRef}>
      <header className="page-header">
        <h1><span className="c-teal">fa</span><span className="c-purple">th</span><span className="c-orange">o</span><span className="c-green">m</span></h1>
        <span className="header-subtitle">updates</span>
        {wallpaper?.reason && (
          <button className="tour-replay-btn" onClick={() => setWallpaperOpen(true)} aria-label="Wallpaper info">
            <Image size={16} />
          </button>
        )}
      </header>

      <>
          {(pullDistance > 0 || isRefreshing) && (
            <div className="feed-pull-indicator" style={{ height: `${pullDistance}px` }}>
              <div className={`feed-pull-spinner${isRefreshing ? " spinning" : ""}`} />
            </div>
          )}

          {unreadCount > 0 && (
            <div className="feed-unread-banner" role="button" tabIndex={0} onClick={onChatOpen} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChatOpen()}>
              <MessageCircle size={16} />
              <span>{unreadCount} new {unreadCount === 1 ? "message" : "messages"} from fathom</span>
            </div>
          )}

          <div className="feed">
            {stackedNewItems.map((entry, index) =>
              entry.stacked ? (
                <FeedItem key={entry.items[0].id} item={entry.items[0]} stackedItems={entry.items} unreadThreads={unreadThreads} threadCounts={threadCounts} onSelect={(item) => setSelectedItemId(item.id)} onDismiss={handleDismiss} />
              ) : (
                <FeedItem key={entry.item.id} item={entry.item} unreadThread={unreadThreads.has(entry.item.id)} threadCount={threadCounts.get(entry.item.id)} onSelect={(item) => setSelectedItemId(item.id)} onDismiss={handleDismiss} showSwipeHint={index === 0} />
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

          {initialLoadDone && <FeedEmpty hasNotifications={newItems.length > 0} />}

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
