"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  store: {
    get: (key) => electron.ipcRenderer.invoke("store:get", key),
    set: (key, value) => electron.ipcRenderer.invoke("store:set", key, value),
    delete: (key) => electron.ipcRenderer.invoke("store:delete", key),
    clear: () => electron.ipcRenderer.invoke("store:clear")
  }
});
