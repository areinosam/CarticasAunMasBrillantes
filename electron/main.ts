import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import Store from 'electron-store'

// Initialize the store with default values
interface StoreSchema {
  collection: unknown[]
  decks: unknown[]
}

const store = new Store<StoreSchema>({
  defaults: {
    collection: [],
    decks: []
  }
})

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    show: false
  })

  // Show window when ready to avoid flash
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// IPC Handlers for storage
ipcMain.handle('store:get', (_event, key: keyof StoreSchema) => {
  return store.get(key)
})

ipcMain.handle('store:set', (_event, key: keyof StoreSchema, value: unknown) => {
  store.set(key, value as StoreSchema[keyof StoreSchema])
  return true
})

ipcMain.handle('store:delete', (_event, key: keyof StoreSchema) => {
  store.delete(key)
  return true
})

ipcMain.handle('store:clear', () => {
  store.clear()
  return true
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
