# Ralph UX Proposals — Fathom App

Generated 2026-03-23. For human review — do not auto-commit code changes except where marked `quick-win`.

---

## P16: Feed Experience

### Already committed (quick wins)
- **Layout type removed from footer** — cards were showing "standard · 2h ago" (internal enum leaked to UI). Now just "2h ago".
- **Space key on unread banner** — `role="button"` now handles both Enter and Space per ARIA spec.

---

### Proposals

#### 1. Loading skeleton instead of "loading..." text `quick-win`

**Current:** Feed shows `<div class="loading">loading...</div>` — plain text, no shape.

**Proposal:** Replace with 2–3 skeleton card shapes (rounded rect for title, two lines for body, small footer bar) using a CSS shimmer animation. This matches the card layout so the transition feels instant rather than jarring.

```jsx
// Feed.jsx — replace the loading block
function FeedSkeleton() {
  return (
    <div className="feed">
      {[1, 2, 3].map((i) => (
        <div key={i} className="feed-item feed-item-skeleton">
          <div className="skeleton-title" />
          <div className="skeleton-body" />
          <div className="skeleton-body skeleton-body-short" />
          <div className="skeleton-footer" />
        </div>
      ))}
    </div>
  );
}
```

CSS shimmer: `background: linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.05) 50%, var(--bg-card) 75%)` with `background-size: 200%` animating `background-position` left→right over 1.5s.

**Tag:** `quick-win`

---

#### 2. Dismiss-all button in "Earlier" section `medium`

**Current:** "Earlier · N" toggle reveals dismissed cards but there's no way to clear them — they accumulate indefinitely and stay in localStorage.

**Proposal:** Add a "Clear all" button in the Earlier header. On press, calls `dismissFeedItem` for any remaining server items (or just clears them locally if already dismissed). Collapses the section after.

```jsx
<button className="feed-earlier-toggle" onClick={() => setEarlierOpen(!earlierOpen)}>
  Earlier · {earlierItems.length}
</button>
{earlierItems.length > 0 && (
  <button className="feed-earlier-clear" onClick={handleClearAll} aria-label="Clear earlier">
    Clear
  </button>
)}
```

**Tag:** `medium`

---

#### 3. Hero/featured cards should look hero/featured `medium`

**Current:** `layout-hero` and `layout-featured` get CSS classes but the visual difference is mostly just body text clamping limits. Both look basically identical to a standard card except for line count.

**Proposal:**
- **Hero:** Full-bleed image (if attachment present) as card background with text overlay. Larger title font. The card should feel like a spotlight item.
- **Featured:** Colored left border accent using `workspace_color`, slightly taller body. Feels more important than standard but not as dominant as hero.

Reference: iOS notification center treats rich notifications with media significantly differently from text-only ones. The visual weight communicates urgency.

**Tag:** `medium`

---

#### 4. Swipe-left to open detail panel `medium`

**Current:** Swipe-right dismisses. Swipe-left does nothing (snaps back).

**Proposal:** Swipe-left (negative dx past a threshold ~60px) opens the detail panel instead of snapping back. This gives the feed a spatial model — right=dismiss, left=expand — consistent with iOS Mail and similar apps.

Implementation: in `handleTouchEnd`, check `swipeDx.current < -60 && onSelect` and call `onSelect(item)`.

**Tag:** `medium`

---

#### 5. "Dismiss all" from stacked card `quick-win`

**Current:** Stacked card shows N rows, each with its own X button. To clear a whole workspace burst you have to tap X N times.

**Proposal:** Add a "Dismiss all" button to the stacked card footer alongside the workspace name. Single press calls `onDismiss` for every item in `stackedItems`.

```jsx
{onDismiss && (
  <button
    className="feed-stacked-dismiss-all"
    onClick={(e) => { e.stopPropagation(); stackedItems.forEach((s) => onDismiss(s.id)); }}
    aria-label="Dismiss all"
  >
    Dismiss all
  </button>
)}
```

**Tag:** `quick-win`

---

#### 6. Pull-to-refresh `big`

**Current:** Feed auto-polls every 30s. On mobile there's no way to manually refresh except waiting.

**Proposal:** Implement pull-to-refresh on the feed scroll container. On pull threshold (60px), trigger `fetchFeed()` immediately and show a small spinner in the pull zone. This is standard mobile UX and avoids users wondering if the feed is stale.

Implementation: touch event on the `.page` element, track scroll position (only trigger when already at top), use a `<div class="feed-pull-indicator">` that animates in during pull.

**Tag:** `big`

---

#### 7. Unread thread dot visibility `quick-win`

**Current:** The unread dot on a card title is a small circle. It sits inside the `<h3>` text which makes it easy to miss, especially on cards with long titles where the dot is followed immediately by text.

**Proposal:** Move the unread dot to the card's left edge (CSS `::before` on `.feed-item` with `position: absolute; left: 0; top: 50%; width: 3px; height: 60%; background: var(--accent)`) rather than inline in the title. This is the pattern used by Slack, Gmail, and most notification centers — a left-rail indicator is instantly scannable without reading the title.

**Tag:** `quick-win`

---

#### 8. FeedEmpty — don't show before first load `quick-win`

**Current:** If `newItems.length === 0` the empty state renders. On initial mount before the first API call resolves, `allItems = []` so `newItems = []` and the empty state briefly flashes before items appear. The `loading` state guard prevents this for the full page, but if the component remounts with a warm cache it might still flicker.

**Proposal:** Add an `initialLoadDone` ref that flips to true after the first successful fetch. Only render `FeedEmpty` when `!loading && initialLoadDone && newItems.length === 0`. This prevents the empty→populated flicker.

**Tag:** `quick-win`

---

#### 9. Compact layout body truncation feedback `medium`

**Current:** `layout-compact` clamps body to 1 line with `overflow: hidden` but there's no visual "more" indicator (ellipsis or fade). Users may not know the card is truncated.

**Proposal:** Add `text-overflow: ellipsis; white-space: nowrap` to `.feed-item.layout-compact .feed-item-body` so truncation is visually explicit, or use a CSS mask fade at the bottom for multi-line truncation. This is standard pattern in any news feed.

**Tag:** `quick-win`

---

### Summary table

| # | Proposal | Tag |
|---|----------|-----|
| 1 | Loading skeleton | `quick-win` |
| 2 | Dismiss-all in Earlier section | `medium` |
| 3 | Hero/featured visual differentiation | `medium` |
| 4 | Swipe-left to open detail | `medium` |
| 5 | Dismiss-all on stacked card | `quick-win` |
| 6 | Pull-to-refresh | `big` |
| 7 | Left-rail unread indicator | `quick-win` |
| 8 | No FeedEmpty before first load | `quick-win` |
| 9 | Compact truncation feedback | `quick-win` |
