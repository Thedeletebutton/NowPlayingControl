# CLAUDE.md

## Project Overview

Now Playing Control is an Electron app that manages a "Now Playing" text overlay for OBS browser sources. It parses a Rekordbox XML library for track search and uses Server-Sent Events (SSE) to push real-time updates to the overlay.

## Tech Stack

- **Runtime**: Node.js (ESM modules via `"type": "module"` in package.json)
- **Frontend**: Vanilla HTML/JS/CSS (no framework, single-file pages)
- **Backend**: Express.js server (`server.js`)
- **Desktop**: Electron (`main.js`)
- **XML Parsing**: fast-xml-parser

## Project Structure

- `server.js` — Express server with all API endpoints, SSE, Rekordbox XML parsing, settings management. Exports `serverReady` promise for Electron.
- `main.js` — Electron main process. Imports `serverReady` from server.js, creates BrowserWindow.
- `preload.js` — Electron preload script for IPC bridge.
- `public/index.html` — Control panel UI (search, settings, manual entry).
- `public/overlay.html` — OBS browser source overlay page (receives SSE updates).
- `settings.json` — Persisted display settings (fonts, colors, shadows, etc.).
- `rekordbox.xml` — Exported Rekordbox library (14,000+ tracks). Bundled as `extraResources` in builds.

## Key Architecture Details

- **No OBS WebSocket**: The app does NOT use obs-websocket-js. It serves an overlay page (`/overlay`) as an OBS browser source and pushes updates via SSE (`/api/events`).
- **Rekordbox XML path resolution**: `findRekordboxXML()` checks multiple locations in order: env var, `process.resourcesPath` (packaged Electron), `__dirname`, parent dir, home dir.
- **ESM + Electron asar**: `node_modules` must be unpacked from asar (`"asarUnpack": ["node_modules/**"]`) to avoid ESM resolution failures in packaged builds.
- **serverReady export**: `server.js` exports a `serverReady` promise that resolves when Express is listening. `main.js` awaits this before creating the window.

## API Endpoints

- `GET /api/status` — Track count, current track, overlay URL
- `GET /api/search?q=` — Search Rekordbox library
- `POST /api/set` — Set now playing (`{artist, title, label}`)
- `POST /api/clear` — Clear overlay
- `POST /api/reload-library` — Reload Rekordbox XML
- `GET /api/settings` — Get display settings
- `POST /api/settings` — Update display settings
- `POST /api/settings/reset` — Reset to defaults
- `GET /api/events` — SSE stream for real-time overlay updates
- `GET /overlay` — Overlay HTML page for OBS browser source

## Build & Deploy

```bash
npm start              # Run Electron app (dev)
npm run server         # Run Express server only
npm run build          # Build macOS DMG
npm run build:win      # Build Windows installer
```

After building, install by copying the `.app` from the DMG to `/Applications/`.

## Common Issues

- **Blank window**: `public/` directory is missing frontend files.
- **"Cannot find package" in packaged app**: `asarUnpack` not set for `node_modules`.
- **"does not provide export named serverReady"**: `server.js` must export `serverReady`.
- **Database stuck loading**: Rekordbox XML path not resolving — check `process.resourcesPath` for packaged builds.
- **Port**: Default is 5050. Override with `HTTP_PORT` env var.
