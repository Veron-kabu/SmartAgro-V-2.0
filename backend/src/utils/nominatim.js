// utils/nominatim.js
// Tiny Nominatim client with polite defaults. Uses public endpoint with a descriptive User-Agent.
// Docs: https://nominatim.org/release-docs/develop/api/Overview/

const DEFAULT_BASE = 'https://nominatim.openstreetmap.org'

// Simple in-process rate limiter: max 1 request per 1s (per process)
let lastCallAt = 0
async function throttle(ms = 1000) {
  const now = Date.now()
  const delta = now - lastCallAt
  if (delta < ms) {
    await new Promise((r) => setTimeout(r, ms - delta))
  }
  lastCallAt = Date.now()
}

function buildHeaders() {
  const appName = process.env.APP_NAME || 'SmartAgro'
  const email = process.env.CONTACT_EMAIL || ''
  let ua = `${appName} Nominatim Client (+https://www.openstreetmap.org; ${process.env.NODE_ENV || 'dev'})`
  if (email) ua += `; ${email}`
  return {
    'User-Agent': ua,
    'Accept': 'application/json',
  }
}

export async function geocode(query, { limit = 5, baseUrl = DEFAULT_BASE } = {}) {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  await throttle()
  const url = new URL(baseUrl + '/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 10))))
  const res = await fetch(url.toString(), { headers: buildHeaders() })
  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`)
  const items = await res.json()
  // Normalize a subset we care about
  return items.map((it) => ({
    lat: Number(it.lat),
    lng: Number(it.lon),
    placeName: it.display_name,
    address: it.address || null,
    raw: it,
  }))
}

export async function reverseGeocode(lat, lng, { baseUrl = DEFAULT_BASE } = {}) {
  if (!(Number.isFinite(lat) && Number.isFinite(lng))) throw new Error('lat/lng required')
  await throttle()
  const url = new URL(baseUrl + '/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  const res = await fetch(url.toString(), { headers: buildHeaders() })
  if (!res.ok) throw new Error(`Nominatim reverse failed: ${res.status}`)
  const data = await res.json()
  return {
    lat: Number(data.lat),
    lng: Number(data.lon),
    placeName: data.display_name,
    address: data.address || null,
    raw: data,
  }
}
