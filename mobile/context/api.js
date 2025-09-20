const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5001"

export async function authFetch(url, options = {}) {
  // This should be called within a component that has access to Clerk context
  const token = await getAuthToken()
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  }

  const res = await fetch(url, { ...options, headers })
  return res
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

export async function getJSON(url) {
  const res = await authFetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export async function postJSON(url, body) {
  const res = await authFetch(url, { method: "POST", body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export async function patchJSON(url, body) {
  const res = await authFetch(url, { method: "PATCH", body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export { apiUrl }
