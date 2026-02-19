"use strict";
const electron = require("electron");
const path = require("path");
const Store = require("electron-store");
const store = new Store({
  defaults: {
    collection: [],
    decks: []
  }
});
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#1a1a2e",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: "default",
    show: false
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return mainWindow;
}
electron.ipcMain.handle("store:get", (_event, key) => {
  return store.get(key);
});
electron.ipcMain.handle("store:set", (_event, key, value) => {
  store.set(key, value);
  return true;
});
electron.ipcMain.handle("store:delete", (_event, key) => {
  store.delete(key);
  return true;
});
electron.ipcMain.handle("store:clear", () => {
  store.clear();
  return true;
});
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
