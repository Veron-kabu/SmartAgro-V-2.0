// mobile/utils/geocoding.js
// Thin client for Nominatim using public endpoint. Keep request rate low (<1 req/sec).

const BASE = 'https://nominatim.openstreetmap.org'
let lastCall = 0
async function throttle(ms = 1000) {
  const now = Date.now()
  const delta = now - lastCall
  if (delta < ms) await new Promise(r => setTimeout(r, ms - delta))
  lastCall = Date.now()
}

function headers() {
  const ua = 'SmartAgro Mobile (Leaflet/Nominatim)'
  return { 'User-Agent': ua, 'Accept': 'application/json' }
}

export async function geocode(query, { limit = 5 } = {}) {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  await throttle()
  const url = new URL(BASE + '/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 10))))
  const res = await fetch(url.toString(), { headers: headers() })
  if (!res.ok) throw new Error('geocode failed')
  const items = await res.json()
  return items.map((it) => ({
    lat: Number(it.lat),
    lng: Number(it.lon),
    placeName: it.display_name,
    address: it.address || null,
  }))
}

export async function reverseGeocode(lat, lng) {
  if (!(Number.isFinite(lat) && Number.isFinite(lng))) throw new Error('lat/lng required')
  await throttle()
  const url = new URL(BASE + '/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  const res = await fetch(url.toString(), { headers: headers() })
  if (!res.ok) throw new Error('reverse failed')
  const data = await res.json()
  return { lat: Number(data.lat), lng: Number(data.lon), placeName: data.display_name, address: data.address || null }
}
