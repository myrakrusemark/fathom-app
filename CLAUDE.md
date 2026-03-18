# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Fathom App is a React PWA dashboard for the Fathom distributed agent system. It provides feed aggregation, real-time chat (WebSocket), routine/workspace management, vault file browsing, and onboarding — all communicating with a fathom-vault backend at port 4243.

## Commands

```bash
npm run dev      # Vite dev server (proxies /api → localhost:4243)
npm run build    # Production build → dist/
npm run preview  # Preview production build
npx eslint .     # Lint (flat config, React hooks + refresh plugins)
```

No test framework is configured.

## Architecture

**Stack:** React 19, React Router 7, Vite 6, plain CSS, no TypeScript.

**API layer** (`src/api/client.js`): ~50 functions wrapping REST endpoints. All requests use Bearer token auth from localStorage (`fathom_connection`). WebSocket connections for chat use token as query param.

**State management:** All in `App.jsx` via React state + props drilling. No Redux/Zustand. Key persistent state lives in localStorage (`fathom_connection` for auth, `fathom-show-backstage` for UI toggle).

**Routing** (`App.jsx`): `/` = Feed, `/backstage` = admin tabs (Routines, Workspaces, Comms, Vault), `*` = redirect to `/`.

**Key component relationships:**
- `App.jsx` owns all top-level state (connection, chat, modals, onboarding, atmosphere)
- `Feed.jsx` polls `/api/feed` + `/api/room/list` every 30s; renders stacked notification cards
- `ChatSheet.jsx` is a bottom-sheet modal with WebSocket streaming, voice input, file attachments
- `Backstage.jsx` contains tab components: `Routines`, `Workspaces`, `Comms`, `Vault`
- `SettingsModal.jsx` handles connection setup, packages, Claude auth, atmosphere selection
- `Onboarding.jsx` runs name input → interest selection → workspace/routine creation

**Styling** (`src/styles/app.css`): Glass morphism design system using CSS variables (`--bg-card`, `--glass-blur`, `--accent`, `--radius`). Mobile-first with safe-area-inset support. Eight atmosphere themes defined in `src/data/atmospheres.js`.

**Feed stacking logic:** 3+ consecutive cards from the same workspace collapse into rows. Hero/featured layouts prevent stacking. Thread tracking uses `notif-{workspace}-{itemId}` rooms.

## Deployment

Docker multi-stage: Node 22 Alpine build → Nginx Alpine serving `dist/` on port 8080. SPA routing via `nginx.conf` (`try_files $uri $uri/ /index.html`).

## Conventions

- JavaScript only (no TypeScript), ES modules throughout
- ESLint: `no-unused-vars` allows uppercase/underscore-prefixed vars; `react-hooks/set-state-in-effect` is a warning
- `npm ci --legacy-peer-deps` required for install (peer dep conflicts)
- HTML in feed notifications is sanitized via `rehype-sanitize` with a custom schema (`src/lib/sanitize.js`)
- Voice input uses the native `SpeechRecognition` API (browser support required)
