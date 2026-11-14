const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alentoDesktop", Object.freeze({
  isDesktop: true,
  setWebViewBounds: (bounds) => ipcRenderer.send("alento:web-view-bounds", bounds),
  setWebViewVisible: (visible) => ipcRenderer.send("alento:web-view-visible", Boolean(visible)),
  navigateWebView: (url) => ipcRenderer.send("alento:web-view-navigate", url),
  reloadWebView: () => ipcRenderer.send("alento:web-view-reload")
}));
