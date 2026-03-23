# Ralph Progress

## Coverage Matrix

| Perspective | app |
|-------------|-----|
| 1. Dead Code & Cleanup | DONE |
| 2. Senior Dev Audit | DONE |
| 3. Bug Hunt | DONE |
| 4. Quality Scaffold | DONE |
| 5. Test Creation | DONE |
| 6. Security Review | DONE |
| 7. Performance | DONE |
| 8. Dependency Audit | DONE |
| 9. Cross-Repo Coherence | DONE |
| 10. API Consistency | - |
| 11. Docker & DevOps | - |
| 12. Accessibility | - |
| 13. Error Boundary Audit | - |
| 14. Utility Consolidation | - |
| 15. New Perspectives | - |
| 16–25. UX Perspectives | - |

## Next Target

Perspective 10: API Consistency / app

## Deferred Upgrades

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `vite` | 6.4.1 | 8.0.2 | Vite 8 switches to Rolldown/Oxc; config is minimal so migration risk is low — run `npm install vite@8 @vitejs/plugin-react@6` + test |
| `@vitejs/plugin-react` | 4.7.0 | 6.0.1 | Tied to Vite — upgrade together with Vite 8 |

## Log

### 2026-03-23 — Perspective 9: Cross-Repo Coherence / app

- Audited all ~50 client.js functions against server router files (conversation, room, startup, packages, activation, version, settings)
- **3 dead client functions removed**: `getWeather()` (endpoint removed from server, silently failed, weather pill never rendered), `getReceipt(id)` (never existed, no callers), `getWorkspaces()` (server only has POST, no callers)
- **Weather cleanup**: removed `WeatherIcon` component, `weather` state, and `getWeather` useEffect from Feed.jsx (-33 lines)
- **OPEN BUG**: `saveMementoCredentials`/`deleteMementoCredentials` call `/api/packages/memento/credentials` which has no server handler — manual Memento key entry UI shows "Failed to save" on every attempt. Needs server-side endpoint. Documented in findings but left in client (UI depends on it).
- **Verified clean**: `getWorkspaceProfiles()` response shape matches (`data.profiles` used correctly by both Comms.jsx and testConnection()); `getBrowserSessions()` returns `{sessions:[]}` shape matching client expectation

### 2026-03-23 — Perspective 8: Dependency Audit / app

- **0 vulnerabilities** — `npm audit` clean
- **Patched**: `eslint` 10.0.3→10.1.0, `react-router-dom` 7.13.1→7.13.2
- **Upgraded**: `lucide-react` 0.577.0→1.0.1 — only breaking change is brand icon removal; app uses zero brand icons. Build and lint pass.
- **Deferred**: `vite` 6→8 (Rolldown/Oxc switch), `@vitejs/plugin-react` 4→6 (upgrade together with Vite). Config is minimal so migration risk is low.

### 2026-03-23 — Perspective 7: Performance / app

- **Memoized `stackByWorkspace(newItems)`** in Feed.jsx — was recomputing on every render (badge updates, wallpaper changes); now only runs when feed items change
- **Memoized message grouping** in ChatSheet.jsx — replaced inline IIFE with `useMemo([messages])`; O(n) JSX work now skips on scroll/focus/isProcessing renders
- **Removed redundant `body.style` writes** in App.jsx Effect 2 — 4 duplicate DOM writes (backgroundImage/Size/Position/Attachment) that Effect 1 already covers
- **Stable keys in Comms RoomView** — `key={msg.id || sender+timestamp}` instead of index
- Bundle: 714KB main chunk; react-markdown pulled in by FeedItem (initial paint), so can't defer it without a bigger refactor. Photoswipe already split by Vite.

### 2026-03-23 — Perspective 6: Security Review / app

- **XSS prevention**: Added URL protocol allowlist to `inlineMarkdown()` in ChatMessage.jsx — `javascript:` and `data:` hrefs now render as `#`
- **Missing auth header**: `getBrowserSessions()` was the only fetch in client.js without an Authorization header — fixed
- **Path encoding**: Added `encodeURIComponent` to `fireRoutine()`, `getVaultFile()`, and `vaultRawUrl()` — consistent with rest of API
- **Dependency vuln**: Removed unused `vite-plugin-pwa` (5 high-severity vulns). `npm audit fix` cleared 1 remaining in flatted
- **CSP**: Added Content-Security-Policy meta tag to index.html — blocks inline script injection, restricts font/connect sources
- **authUrl consolidation**: Removed 3 duplicate `authUrl()` definitions (ChatMessage, FeedDetailPanel, FeedItem); single canonical export in formatters.js



### 2026-03-23 — Perspectives 2-5 + Pre-commit Hooks / app

**P2 Senior Dev Audit:**
- Created `src/lib/formatters.js` with canonical timeAgo, timeUntil, formatTimestamp, prettyName, stripChatDecorations
- Removed 8 duplicate implementations across Routines, Vault, FeedItem, FeedDetailPanel, Workspaces, Comms, ChatMessage, WallpaperPanel

**P3 Bug Hunt:**
- Fixed `audio.play()` unhandled Promise in AudioPlayerContext.jsx (was silently failing on mobile autoplay block; setPlaying now keyed on actual play() resolution)
- Fixed index-based React list keys in FeedDetailPanel.jsx → stable att.url/att.label keys
- Extracted 5 magic number timeout constants in FeedItem.jsx (DISMISS_DELAY_MS, SWIPE_HINT_MS, etc.)
- Confirmed connectWs stale closure concern was a false positive (isDmModeRef pattern is correct)

**P4 Quality Scaffold:**
- Cleared all 7 ESLint warnings (fixed SettingsModal missing dep; added explain comments to intentional patterns)
- Added `no-console: ["warn", { allow: ["error","warn"] }]` rule to eslint.config.js
- Fixed `className` → `class` bug in sanitize.js (hast uses HTML attribute names)
- Added explanatory comment for intentional `style` on `"*"` in sanitize schema

**P5 Test Creation:**
- Installed Vitest 4.1 + @testing-library/react + jsdom
- Configured vite.config.js test block and package.json test scripts
- 37 passing tests: formatters.js (25), connection.js (9), sanitize.js (7)

**Pre-commit Hooks:**
- husky + lint-staged: ESLint runs on staged .js/.jsx files (--max-warnings=0)

### 2026-03-23 — Perspective 1: Dead Code & Cleanup / app
- Deleted `src/components/Chat.jsx` (85 lines) — legacy component, `sendChat` never implemented, not rendered anywhere
- Removed `getChat()` from `src/api/client.js` — only caller was deleted Chat.jsx
- No other commented-out code or dead imports found
- Metrics: -106 lines

### 2026-03-23 — Bootstrap
- Created ralph-prd.md, ralph-progress.md, ralph-findings.json
- Branch: `ralph`
- Pre-audit findings documented in ralph-findings.json
