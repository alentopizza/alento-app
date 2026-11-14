const { app, BrowserWindow, WebContentsView, ipcMain, shell, session } = require("electron");
const path = require("node:path");

const APP_URL = process.env.ALENTO_APP_URL || "https://alentopizza.com";
const WHATSAPP_URL = "https://web.whatsapp.com/";
const WHATSAPP_PARTITION = "persist:alento-whatsapp";
const PANEL_MIN_WIDTH = 360;
let mainWindow;
let whatsappView;
let whatsappVisible = true;
let whatsappBounds = null;

function safeBounds(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (x < 0 || y < 0 || width < PANEL_MIN_WIDTH || height < 240) return null;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function applyWhatsAppBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !whatsappView || !whatsappBounds) return;
  const { width: contentWidth, height: contentHeight } = mainWindow.getContentBounds();
  const bounded = safeBounds(whatsappBounds);
  if (!bounded) return;
  const x = Math.min(bounded.x, Math.max(0, contentWidth - PANEL_MIN_WIDTH));
  const width = Math.min(bounded.width, contentWidth - x);
  const height = Math.min(bounded.height, contentHeight - bounded.y);
  if (width < PANEL_MIN_WIDTH || height < 240) {
    whatsappView.setVisible(false);
    return;
  }
  whatsappView.setBounds({ x, y: bounded.y, width, height });
  whatsappView.setVisible(whatsappVisible);
}

function createWhatsAppView() {
  if (whatsappView) return whatsappView;
  const whatsappSession = session.fromPartition(WHATSAPP_PARTITION);
  whatsappView = new WebContentsView({
    webPreferences: {
      partition: WHATSAPP_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.contentView.addChildView(whatsappView);
  whatsappView.setVisible(false);
  whatsappView.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  whatsappView.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("https://web.whatsapp.com/") && !url.startsWith("https://www.whatsapp.com/")) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  whatsappView.webContents.loadURL(WHATSAPP_URL);
  void whatsappSession;
  return whatsappView;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1720,
    height: 960,
    minWidth: 1100,
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
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    createWhatsAppView();
    applyWhatsAppBounds();
  });

  mainWindow.on("resize", applyWhatsAppBounds);
  mainWindow.on("maximize", applyWhatsAppBounds);
  mainWindow.on("unmaximize", applyWhatsAppBounds);
  mainWindow.on("closed", () => {
    mainWindow = null;
    whatsappView = null;
  });

  mainWindow.loadURL(APP_URL);
}

ipcMain.on("alento:whatsapp-bounds", (event, bounds) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  const next = safeBounds(bounds);
  if (!next) return;
  whatsappBounds = next;
  if (!whatsappView) createWhatsAppView();
  applyWhatsAppBounds();
});

ipcMain.on("alento:whatsapp-visible", (event, visible) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  whatsappVisible = Boolean(visible);
  if (whatsappVisible) {
    createWhatsAppView();
    applyWhatsAppBounds();
  } else if (whatsappView) {
    whatsappView.setVisible(false);
  }
});

ipcMain.on("alento:whatsapp-reload", (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || !whatsappView) return;
  whatsappView.webContents.reload();
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
