const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alentoDesktop", Object.freeze({
  isDesktop: true,
  setWhatsAppBounds: (bounds) => ipcRenderer.send("alento:whatsapp-bounds", bounds),
  setWhatsAppVisible: (visible) => ipcRenderer.send("alento:whatsapp-visible", Boolean(visible)),
  reloadWhatsApp: () => ipcRenderer.send("alento:whatsapp-reload")
}));
