export function load<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fallback
    const out = { ...fallback }
    for (const k of Object.keys(fallback) as (keyof T)[]) {
      const v = (parsed as Partial<T>)[k]
      if (typeof v === typeof fallback[k]) out[k] = v as T[keyof T]
    }
    return out
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works without it.
  }
}
