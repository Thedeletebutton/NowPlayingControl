// server.js - Now Playing Control (Browser Source + Rekordbox XML)
// Run: node server.js
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { fileURLToPath } from "url";

dotenv.config();

// -------------------- Paths --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const settingsFile = path.join(__dirname, "settings.json");

// -------------------- Env --------------------
const HTTP_PORT = process.env.HTTP_PORT || "5050";

// Find rekordbox.xml - check multiple locations
function findRekordboxXML() {
  const candidates = [
    process.env.RB_XML,
    path.join(process.resourcesPath || "", "rekordbox.xml"),
    path.join(__dirname, "rekordbox.xml"),
    path.join(__dirname, "..", "rekordbox.xml"),
    path.join(os.homedir(), "rekordbox.xml"),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`📁 Found rekordbox.xml at: ${p}`);
      return p;
    }
  }
  return path.join(os.homedir(), "rekordbox.xml");
}

const RB_XML = findRekordboxXML();

// -------------------- State --------------------
let currentTrack = { artist: "", title: "", label: "" };
let sseClients = [];

// Default display settings
const defaultSettings = {
  fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
  fontWeight: 700,
  artistSize: 48,
  artistColor: "#ffffff",
  trackSize: 40,
  trackColor: "#ffffff",
  labelSize: 32,
  labelColor: "#ffffff",
  backgroundColor: "transparent",
  textAlign: "left",
  showLabel: true,
  padding: 20,
  lineSpacing: 4,
  textShadow: true,
  shadowColor: "#ff0000",
  shadowBlur: 0,
  shadowOffsetX: 2,
  shadowOffsetY: 3,
  shadow2Enabled: false,
  shadow2Color: "#000000",
  shadow2Blur: 0,
  shadow2OffsetX: 4,
  shadow2OffsetY: 6,
  textStroke: true,
  strokeColor: "#000000",
  strokeWidth: 2,
  strokePosition: "outside",
  glowEnabled: false,
  glowColor: "#ff0000",
  glowSize: 18,
  pulseEnabled: false,
  pulseSpeed: 2.5,
};

let displaySettings = { ...defaultSettings };

// Load settings from file
function loadSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      const data = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      displaySettings = { ...defaultSettings, ...data };
    }
  } catch (e) {
    console.log("⚠️ Could not load settings:", e.message);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(displaySettings, null, 2));
  } catch (e) {
    console.log("⚠️ Could not save settings:", e.message);
  }
}

loadSettings();

// -------------------- Express --------------------
const app = express();
app.use(express.json());

// Serve UI
app.use(express.static(publicDir));
app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/overlay", (_req, res) => res.sendFile(path.join(publicDir, "overlay.html")));

// -------------------- SSE for real-time updates --------------------
function broadcastUpdate() {
  const data = JSON.stringify({ track: currentTrack, settings: displaySettings });
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send initial state
  const data = JSON.stringify({ track: currentTrack, settings: displaySettings });
  res.write(`data: ${data}\n\n`);

  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// -------------------- Helpers --------------------
function formatTitleLine(artist, title) {
  const a = (artist ?? "").toString().trim();
  const t = (title ?? "").toString().trim();
  if (a && t) return `${a} – ${t}`;
  return (t || a || "").trim();
}
function formatLabelLine(label) {
  const l = (label ?? "").toString().trim();
  return l ? `[${l}]` : `[Unreleased]`;
}

// -------------------- Rekordbox XML parsing --------------------
function norm(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

let rbTracks = []; // { artist, title, label, key }

function extractTrackObject(t) {
  if (!t || typeof t !== "object") return null;

  const artist = (t.Artist || t.ARTIST || t.artist || "").toString().trim();
  const title =
    (t.Name || t.Title || t.TITLE || t.name || t.title || "").toString().trim();
  const label = (t.Label || t.LABEL || t.label || "").toString().trim();

  if (!artist && !title) return null;

  return {
    artist,
    title,
    label,
    key: norm(`${artist} ${title} ${label}`),
  };
}

// Recursively collect TRACK nodes (robust vs different XML shapes)
function collectTracksRecursive(node, out) {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) collectTracksRecursive(item, out);
    return;
  }

  if (typeof node !== "object") return;

  if (node.TRACK) {
    const tracksNode = node.TRACK;
    if (Array.isArray(tracksNode)) {
      for (const t of tracksNode) {
        const tr = extractTrackObject(t);
        if (tr) out.push(tr);
      }
    } else {
      const tr = extractTrackObject(tracksNode);
      if (tr) out.push(tr);
    }
  }

  for (const k of Object.keys(node)) {
    collectTracksRecursive(node[k], out);
  }
}

function loadRekordboxXML() {
  try {
    if (!fs.existsSync(RB_XML)) {
      console.log(`⚠️ RB XML not found at: ${RB_XML}`);
      rbTracks = [];
      return;
    }

    const xml = fs.readFileSync(RB_XML, "utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });

    const data = parser.parse(xml);

    const collected = [];
    collectTracksRecursive(data, collected);

    // Deduplicate
    const seen = new Set();
    const deduped = [];
    for (const t of collected) {
      const id = `${norm(t.artist)}|${norm(t.title)}|${norm(t.label)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(t);
    }

    rbTracks = deduped;
    console.log(`🎧 Rekordbox XML loaded: ${rbTracks.length} tracks`);
  } catch (e) {
    console.log("⚠️ Failed to parse RB XML:", e.message);
    rbTracks = [];
  }
}

// Load at startup
loadRekordboxXML();

// -------------------- API --------------------
app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    rb: { xml: RB_XML, count: rbTracks.length },
    track: currentTrack,
    overlayUrl: `http://localhost:${HTTP_PORT}/overlay`,
  });
});

app.post("/api/reload-library", (_req, res) => {
  loadRekordboxXML();
  res.json({ ok: true, count: rbTracks.length });
});

app.get("/api/search", (req, res) => {
  const q = norm(req.query.q || "");
  if (!q) return res.json({ ok: true, results: [] });

  const tokens = q.split(" ").filter(Boolean);

  const results = rbTracks
    .map((t) => {
      let score = 0;
      for (const tok of tokens) if (t.key.includes(tok)) score++;
      return { ...t, score };
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(({ artist, title, label }) => ({ artist, title, label }));

  res.json({ ok: true, results });
});

// Get current track
app.get("/api/track", (_req, res) => {
  res.json({ ok: true, track: currentTrack });
});

// Set "Now Playing"
app.post("/api/set", (req, res) => {
  const { artist = "", title = "", label = "" } = req.body || {};
  currentTrack = { artist, title, label };
  broadcastUpdate();
  res.json({
    ok: true,
    title: formatTitleLine(artist, title),
    label: formatLabelLine(label),
  });
});

// Clear display
app.post("/api/clear", (_req, res) => {
  currentTrack = { artist: "", title: "", label: "" };
  broadcastUpdate();
  res.json({ ok: true });
});

// -------------------- Settings API --------------------
app.get("/api/settings", (_req, res) => {
  res.json({ ok: true, settings: displaySettings });
});

app.post("/api/settings", (req, res) => {
  const updates = req.body || {};
  displaySettings = { ...displaySettings, ...updates };
  saveSettings();
  broadcastUpdate();
  res.json({ ok: true, settings: displaySettings });
});

app.post("/api/settings/reset", (_req, res) => {
  displaySettings = { ...defaultSettings };
  saveSettings();
  broadcastUpdate();
  res.json({ ok: true, settings: displaySettings });
});

// -------------------- Start --------------------
let serverReadyResolve;
export const serverReady = new Promise((resolve) => {
  serverReadyResolve = resolve;
});

app.listen(Number(HTTP_PORT), () => {
  console.log(`🌐 Control Panel: http://localhost:${HTTP_PORT}`);
  console.log(`📺 Browser Source: http://localhost:${HTTP_PORT}/overlay`);
  console.log(`📚 Rekordbox XML: ${RB_XML}`);
  serverReadyResolve();
});
