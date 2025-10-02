import { Platform, NativeModules } from "react-native"
import Constants from "expo-constants"

function detectHostFromBundle() {
  try {
    // In dev, scriptURL is like: http://192.168.0.105:8081/index.bundle?platform=android&dev=true
    const scriptURL = NativeModules?.SourceCode?.scriptURL || ""
    const match = scriptURL.match(/^(https?:)\/\/([^/:]+)(?::(\d+))?/i)
    if (match) {
      const protocol = match[1] || "http:"
      const host = match[2]
      return { protocol, host }
    }
  } catch {}
  return null
}

function computeApiBaseUrl() {
  // 1) Explicit env always wins
  const envUrl = process.env.EXPO_PUBLIC_API_URL
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) return envUrl.trim()

  // 2) Derive from Metro bundle host in dev (SourceCode)
  const derived = detectHostFromBundle()
  if (derived?.host) {
    const protocol = derived.protocol || "http:"
    const port = 5001
    return `${protocol}//${derived.host}:${port}`
  }

  // 3) Derive from Expo Constants (Expo Go host)
  try {
    const hostCandidate =
      Constants?.expoGoConfig?.debuggerHost ||
      Constants?.expoGoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoGo?.hostUri ||
      Constants?.manifest?.debuggerHost ||
      Constants?.manifest?.hostUri ||
      null
    if (hostCandidate && typeof hostCandidate === "string") {
      // forms like "192.168.0.105:8081"
      const host = hostCandidate.split("/")[0].split(":")[0]
      if (host) {
        return `http://${host}:5001`
      }
    }
  } catch {}

  // 4) Platform-specific dev fallbacks (Android emulator only)
  if (Platform.OS === "android" && Constants?.isDevice === false) {
    // Running on Android emulator, host loopback is 10.0.2.2
    return "http://10.0.2.2:5001"
  }

  // 5) Default
  return "http://localhost:5001"
}

const apiUrl = computeApiBaseUrl()

// Join base API URL with a path; pass through absolute URLs untouched
function resolveUrl(pathOrUrl) {
  if (typeof pathOrUrl !== "string" || pathOrUrl.length === 0) return apiUrl
  // If it already looks like an absolute URL, return as-is
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  // Ensure single slash between base and path
  const base = apiUrl.replace(/\/$/, "")
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`
  return `${base}${path}`
}

export async function authFetch(pathOrUrl, options = {}) {
  // This should be called within a component that has access to Clerk context
  const token = await getAuthToken()
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  }

  const url = resolveUrl(pathOrUrl)
  try {
    const res = await fetch(url, { ...options, headers })
    return res
  } catch (err) {
    const e = new Error(`Network error fetching ${url}: ${err?.message || err}`)
    e.cause = err
    e.url = url
    throw e
  }
}

let authTokenGetter = null
export function setAuthTokenGetter(getter) {
  authTokenGetter = getter
}

async function getAuthToken() {
  if (authTokenGetter) {
    return await authTokenGetter()
  }
  return null
}

function isJsonLike(contentType) {
  return typeof contentType === 'string' && contentType.toLowerCase().includes('application/json')
}

async function safeParseJson(res) {
  // Some endpoints may return 204 / empty body. Avoid throwing JSON parse errors.
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch (e) {
    const err = new Error('Failed to parse JSON response')
    err.cause = e
    err.raw = text
    err.url = res.url
    err.status = res.status
    throw err
  }
}

export async function getJSON(pathOrUrl, options = {}) {
  const res = await authFetch(pathOrUrl, options)
  if (!res.ok) {
    let body = null
    try { body = await res.text() } catch { /* ignore */ }
    const err = new Error(`Request failed: ${res.status} ${res.statusText}`)
    err.status = res.status
    err.statusText = res.statusText
    err.url = res.url
    err.body = body
    throw err
  }
  const ct = res.headers.get('content-type') || ''
  if (!isJsonLike(ct)) {
    // Non-JSON success -> return raw text for caller to decide
    return await res.text()
  }
  return safeParseJson(res)
}

// Cancellation-friendly variant (just alias with explicit signal param usage)
export async function getJSONCancelable(pathOrUrl, signal) {
  return getJSON(pathOrUrl, { signal })
}

export async function postJSON(pathOrUrl, body) {
  const res = await authFetch(pathOrUrl, { method: "POST", body: JSON.stringify(body) })
  if (!res.ok) {
    let text = null
    try { text = await res.text() } catch { /* ignore */ }
    const err = new Error(`Request failed: ${res.status} ${res.statusText}`)
    err.status = res.status
    err.statusText = res.statusText
    err.url = res.url
    err.body = text
    throw err
  }
  const ct = res.headers.get('content-type') || ''
  if (!isJsonLike(ct)) return await res.text()
  return safeParseJson(res)
}

export async function patchJSON(pathOrUrl, body) {
  const res = await authFetch(pathOrUrl, { method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) {
    let text = null
    try { text = await res.text() } catch { /* ignore */ }
    const err = new Error(`Request failed: ${res.status} ${res.statusText}`)
    err.status = res.status
    err.statusText = res.statusText
    err.url = res.url
    err.body = text
    throw err
  }
  const ct = res.headers.get('content-type') || ''
  if (!isJsonLike(ct)) return await res.text()
  return safeParseJson(res)
}

export async function deleteJSON(pathOrUrl) {
  const res = await authFetch(pathOrUrl, { method: 'DELETE' })
  if (!res.ok) {
    let text = null
    try { text = await res.text() } catch { /* ignore */ }
    const err = new Error(`Request failed: ${res.status} ${res.statusText}`)
    err.status = res.status
    err.statusText = res.statusText
    err.url = res.url
    err.body = text
    throw err
  }
  const ct = res.headers.get('content-type') || ''
  if (!isJsonLike(ct)) return await res.text()
  return safeParseJson(res)
}

// Lightweight ping helper to test connectivity to backend (e.g., "/health")
export async function ping(path = "/health") {
  const url = resolveUrl(path)
  try {
    const res = await fetch(url)
    return { ok: res.ok, status: res.status, url }
  } catch (err) {
    return { ok: false, status: 0, url, error: err?.message || String(err) }
  }
}

export { apiUrl, resolveUrl }
