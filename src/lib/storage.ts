// Storage wrappers for electron-store via IPC

// Type augmentation for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      store: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<boolean>
        delete: (key: string) => Promise<boolean>
        clear: () => Promise<boolean>
      }
    }
  }
}

export async function storageGet<T>(key: string, defaultValue: T): Promise<T> {
  if (!window.electronAPI) return defaultValue
  const value = await window.electronAPI.store.get(key)
  return (value as T) ?? defaultValue
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  if (!window.electronAPI) return
  await window.electronAPI.store.set(key, value)
}

export async function storageDelete(key: string): Promise<void> {
  if (!window.electronAPI) return
  await window.electronAPI.store.delete(key)
}
