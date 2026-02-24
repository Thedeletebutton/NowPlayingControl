import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "url";
import path from "path";

// Start the Express server and get the ready promise
import { serverReady } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTTP_PORT = process.env.HTTP_PORT || 5050;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 750,
    minWidth: 400,
    minHeight: 500,
    frame: false,
    backgroundColor: "#000000",
    title: "Now Playing Control",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Handle close from renderer
  ipcMain.on("close-window", () => {
    mainWindow.close();
  });

  mainWindow.loadURL(`http://localhost:${HTTP_PORT}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Failed to load:", errorDescription);
    setTimeout(() => {
      mainWindow.loadURL(`http://localhost:${HTTP_PORT}`);
    }, 1000);
  });
}

app.whenReady().then(async () => {
  await serverReady;
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
