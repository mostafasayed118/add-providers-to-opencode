const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

const DEV_URL = process.env.ELECTRON_DEV_URL || "http://localhost:3000";
const isDev = process.env.ELECTRON_DEV === "1";

let nextProc = null;

function startNextProd() {
  // Assumes `npm run build` was run; serves via `next start`
  nextProc = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "start", "--", "-p", "3000"],
    { cwd: __dirname + "/..", stdio: "ignore", shell: false }
  );
}

async function createWindow() {
  if (!isDev) startNextProd();
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const url = isDev ? DEV_URL : "http://localhost:3000";
  // In prod give next start a moment to bind
  if (isDev) {
    await win.loadURL(url);
  } else {
    setTimeout(() => win.loadURL(url).catch(() => {}), 1500);
  }
}

app.whenReady().then(async () => {
  await createWindow();
  if (!isDev) {
    // Packaged app: check GitHub Releases for updates (unsigned build still
    // updates, Windows SmartScreen applies as usual on first install).
    try {
      const { autoUpdater } = require("electron-updater");
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    } catch {
      // auto-update is best-effort; the app works fine without it.
    }
  }
});
app.on("window-all-closed", () => {
  if (nextProc) try { nextProc.kill(); } catch {}
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  if (nextProc) try { nextProc.kill(); } catch {}
});
