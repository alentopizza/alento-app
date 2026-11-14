const { app, BrowserWindow, WebContentsView, ipcMain, shell, session } = require("electron");
const path = require("node:path");

const APP_URL = process.env.ALENTO_APP_URL || "https://alentopizza.com";
const DEFAULT_WEB_URL = "https://web.whatsapp.com/";
const WEB_PARTITION = "persist:alento-whatsapp";
const VIEW_MIN_WIDTH = 360;
let mainWindow;
let webView;
let webViewVisible = false;
let webViewBounds = null;

function isSafeHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function safeBounds(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (x < 0 || y < 0 || width < VIEW_MIN_WIDTH || height < 240) return null;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function applyWebViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !webView || !webViewBounds) return;
  const { width: contentWidth, height: contentHeight } = mainWindow.getContentBounds();
  const bounds = safeBounds(webViewBounds);
  if (!bounds) return;
  const x = Math.min(bounds.x, Math.max(0, contentWidth - VIEW_MIN_WIDTH));
  const y = Math.min(bounds.y, Math.max(0, contentHeight - 240));
  const width = Math.min(bounds.width, contentWidth - x);
  const height = Math.min(bounds.height, contentHeight - y);
  if (width < VIEW_MIN_WIDTH || height < 240) {
    webView.setVisible(false);
    return;
  }
  webView.setBounds({ x, y, width, height });
  webView.setVisible(webViewVisible);
}

function createWebView() {
  if (webView) return webView;
  webView = new WebContentsView({
    webPreferences: {
      partition: WEB_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.contentView.addChildView(webView);
  webView.setVisible(false);
  webView.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeHttpsUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  webView.webContents.on("will-navigate", (event, url) => {
    if (!isSafeHttpsUrl(url)) event.preventDefault();
  });
  webView.webContents.loadURL(DEFAULT_WEB_URL);
  return webView;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1720,
    height: 960,
    minWidth: 1400,
    minHeight: 720,
    title: "ALENTÓ PIZZA | Pizzería en Kennedy, Bogotá",
    backgroundColor: "#0b0b0c",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeHttpsUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("resize", applyWebViewBounds);
  mainWindow.on("maximize", applyWebViewBounds);
  mainWindow.on("unmaximize", applyWebViewBounds);
  mainWindow.on("closed", () => {
    mainWindow = null;
    webView = null;
  });
  mainWindow.loadURL(APP_URL);
}

ipcMain.on("alento:web-view-bounds", (event, bounds) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  const next = safeBounds(bounds);
  if (!next) return;
  webViewBounds = next;
  if (!webView) createWebView();
  applyWebViewBounds();
});

ipcMain.on("alento:web-view-visible", (event, visible) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  webViewVisible = Boolean(visible);
  if (webViewVisible) {
    createWebView();
    applyWebViewBounds();
  } else if (webView) {
    webView.setVisible(false);
  }
});

ipcMain.on("alento:web-view-navigate", (event, url) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || !isSafeHttpsUrl(url)) return;
  createWebView().webContents.loadURL(url);
});

ipcMain.on("alento:web-view-reload", (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || !webView) return;
  webView.webContents.reload();
});

app.whenReady().then(() => {
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
