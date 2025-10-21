// Minimal event bus: no deps, in-memory only (resets on app reload)
const listeners = new Map()

export function on(type, handler) {
  const set = listeners.get(type) || new Set()
  set.add(handler)
  listeners.set(type, set)
  return () => off(type, handler)
}

export function off(type, handler) {
  const set = listeners.get(type)
  if (!set) return
  set.delete(handler)
  if (set.size === 0) listeners.delete(type)
}

export function emit(type, payload) {
  const set = listeners.get(type)
  if (!set) return
  for (const fn of Array.from(set)) {
    try { fn(payload) } catch (_e) { /* no-op */ }
  }
}

export default { on, off, emit }
