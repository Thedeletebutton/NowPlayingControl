# Now Playing Control

Electron app for managing a "Now Playing" overlay in OBS browser sources. Search your Rekordbox library, select a track, and instantly update a styled text overlay on your stream.

## Features

- Search your Rekordbox XML library (artist, track, label)
- Real-time overlay updates via Server-Sent Events
- Customizable overlay styling (fonts, colors, shadows, glow, pulse animation)
- OBS browser source compatible
- Manual track entry
- Settings persist across sessions

## Setup

```bash
npm install
```

### Run in development

```bash
npm start
```

### Run server only (no Electron window)

```bash
npm run server
```

## OBS Browser Source

Add a browser source in OBS pointing to:

```
http://localhost:5050/overlay
```

## Rekordbox XML

Export your library from Rekordbox as XML. The app searches for `rekordbox.xml` in these locations (in order):

1. `RB_XML` environment variable
2. `Contents/Resources/rekordbox.xml` (packaged app)
3. Project directory
4. Parent directory
5. Home directory (`~/rekordbox.xml`)

## Build

```bash
npm run build          # macOS
npm run build:win      # Windows
npm run build:all      # Both
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_PORT` | `5050` | Server port |
| `RB_XML` | _(auto-detected)_ | Path to rekordbox.xml |
