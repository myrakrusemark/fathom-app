# Fathom App

React dashboard for [Fathom Vault](https://github.com/myrakrusemark/fathom-vault). Mobile-first PWA with glass morphism UI. Connects to the Fathom Vault backend via REST API and WebSocket.

Built into the Fathom Vault container by default, but can run standalone against any Fathom Vault instance.

## Features

- **Feed** — notification cards from agent workspaces, with swipe gestures, smart stacking, and pull-to-refresh
- **Chat** — real-time WebSocket conversation with voice input and file attachments
- **Backstage** — admin tabs for routines, workspaces, rooms, and vault browsing
- **Onboarding** — guided setup flow for new installations
- **Themes** — switchable atmosphere themes (CSS served from backend)
- **PWA** — installable, standalone display, mobile safe areas

## Quick Start

```bash
npm install
npm run dev          # dev server (proxies /api → localhost:4243)
```

Requires a running Fathom Vault backend on port 4243. The Vite dev server proxies API and WebSocket requests automatically.

### Standalone / Remote

When running outside the container, open Settings and enter:
- **Server URL** — the Fathom Vault instance (e.g. `http://192.168.1.100:4243`)
- **API Key** — Bearer token from the Fathom Vault dashboard

Connection info is stored in localStorage.

## Build

```bash
npm run build        # production build → dist/
npm run preview      # preview production build locally
```

### Docker

```bash
docker build -t fathom-app .
docker run -p 8080:8080 fathom-app
```

Multi-stage build: Node 22 (build) + Nginx Alpine (serve). SPA routing via `try_files`. Assets cached with 1-year immutable headers.

## Development

```bash
npm run test         # run tests (Vitest + jsdom)
npm run test:watch   # watch mode
npx eslint .         # lint
```

Pre-commit hooks run ESLint via husky + lint-staged.

### Stack

React 19, Vite 6, plain CSS (no Tailwind), plain JavaScript (no TypeScript). State in App.jsx via hooks, no external state library.

## License

MIT
