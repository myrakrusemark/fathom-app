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
| 10. API Consistency | DONE |
| 11. Docker & DevOps | DONE |
| 12. Accessibility | DONE |
| 13. Error Boundary Audit | DONE |
| 14. Utility Consolidation | DONE |
| 15. New Perspectives | - |
| 16–25. UX Perspectives | - |

## Next Target

Perspective 15: New Perspectives / app

## Deferred Upgrades

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `vite` | 6.4.1 | 8.0.2 | Vite 8 switches to Rolldown/Oxc; config is minimal so migration risk is low — run `npm install vite@8 @vitejs/plugin-react@6` + test |
| `@vitejs/plugin-react` | 4.7.0 | 6.0.1 | Tied to Vite — upgrade together with Vite 8 |

## Log

### 2026-03-23 — Perspective 14: Utility Consolidation / app

- `ChatMessage.jsx`: removed dead `export function timeAgo()` — exported but never imported anywhere; ChatMessage now imports `timeAgo` directly from formatters
- `Workspaces.jsx`: two inline `name.replace(/-/g," ").replace(/\b\w/g,...)` expressions replaced with `prettyName(name)` from formatters — added `prettyName` to import
- Confirmed no remaining duplication beyond local `timeAgo` wrapper in Routines.jsx (adds `|| "never"` fallback — intentional local variant, not a consolidation target)
- `consolidation_targets.done` list is complete: timeAgo, prettyName, stripChatDecorations, formatTimestamp, timeUntil, authUrl

### 2026-03-23 — Perspective 13: Error Boundary Audit / app

Mapped all 60+ catch handlers across the codebase. Categorized into acceptable silent failures (background polls, optional features) vs. user-action failures that should surface errors.

**Fixed:**
- `PackageRow`: install/uninstall silently swallowed errors — added `pkgError` state, displayed below buttons (user now sees "Install failed: ..." on error)
- `App.jsx submitOnboarding`: `.catch(() => {})` → `.catch(console.error)` — failure now visible in devtools
- `Routines.jsx RoutineDetailPanel.handleFire` (×2): `try/finally` with no `catch` → added `catch(err) { console.error(err); }` — was unhandled rejection
- `Workspaces.jsx WorkspaceDetailPanel.handleFire`: no error handling at all → wrapped in try/catch

**Verified acceptable silent failures (~30 handlers):** background polls (DM unread, theme, wallpaper, room list, browser sessions, permissions), optional fire-and-forget ops (scout routine), WebSocket parse errors, DM polling errors, SetupPackages install polling.

### 2026-03-23 — Perspective 12: Accessibility / app

- **AudioPlayerBar** scrubber `type=range` was unlabeled — added `aria-label="Seek"`
- **ChatSheet** message input: `aria-label="Message"`; Paperclip icon button: `aria-label="Attach file"`
- **Comms** perspective select: `aria-label="View perspective"`
- **Vault** search input: `aria-label="Search vault"`; workspace select: `aria-label="Workspace"`
- **Routines** filter input: `aria-label="Filter routines"`
- **Feed** unread banner div: added `role="button"`, `tabIndex={0}`, `onKeyDown` Enter handler — was click-only, inaccessible to keyboard users
- **Deferred**: workspace card divs (complex layout implications), chat bubble audio/expand divs (low priority, content-area interaction)

### 2026-03-23 — Perspective 11: Docker & DevOps / app

- **.dockerignore expanded**: added *.md, ralph-*.json, .env*, coverage — keeps audit/docs out of the build image
- **gzip enabled in nginx.conf**: js/css/json/svg compressed (714KB main chunk → ~200KB over wire)
- **Security headers added to nginx**: X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy strict-origin-when-cross-origin (HTTP-level, stronger than meta tags)
- **Dockerfile**: already clean — node:22-alpine build, nginx:alpine serve, layer caching correct

### 2026-03-23 — Perspective 10: API Consistency / app

- **getBrowserSessions()** refactored to use `request()` helper — was the only client function using bespoke fetch with no error propagation (8 lines → 1)
- **Stale `data.workspaces` fallback removed** from Comms.jsx, Vault.jsx, Workspaces.jsx, PermissionToasts.jsx — server has returned `{profiles:{...}}` for a long time; the `data.workspaces` branch was never reachable
- **getDmUnreadCount** simplified: `data.rooms || data || []` → `data.rooms || []`
- **sendVoice confirmed clean**: `/api/voice/send` exists in voice.py router
- No URL naming issues found — paths follow consistent `/api/{noun}/{sub}` pattern

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
