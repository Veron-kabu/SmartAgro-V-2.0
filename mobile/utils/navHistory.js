// Lightweight in-memory nav history for fallback routes per stack
// Not persisted across app restarts (by design); only used when router.canGoBack() is false

const lastRouteByStack = new Map()

export function setLastRoute(stackKey, route) {
  if (!stackKey || !route) return
  try { lastRouteByStack.set(String(stackKey), String(route)) } catch {}
}

export function getLastRoute(stackKey) {
  if (!stackKey) return null
  try { return lastRouteByStack.get(String(stackKey)) || null } catch { return null }
}

export function clearLastRoute(stackKey) {
  try { lastRouteByStack.delete(String(stackKey)) } catch {}
}

export function clearAllLastRoutes() { try { lastRouteByStack.clear() } catch {} }

export default { setLastRoute, getLastRoute, clearLastRoute, clearAllLastRoutes }
