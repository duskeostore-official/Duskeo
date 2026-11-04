/** Storage helpers that never throw (private mode, blocked site data, ...). */

export function readJson<T>(key: string, fallback: T, store: Storage = localStorage): T {
  try {
    const raw = store.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown, store: Storage = localStorage) {
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readString(key: string, store: Storage = localStorage): string | null {
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

export function writeString(key: string, value: string, store: Storage = localStorage) {
  try {
    store.setItem(key, value)
  } catch {
    /* ignore */
  }
}
