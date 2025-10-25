import { getJSON } from "../context/api"
import { productSlug } from "./slug"

// Small client-side fetcher for market prices from our backend proxy
// Falls back to direct Sokisho URL if backend route is unavailable

const DIRECT_URL = "https://sokisho.com/get_products.php"

export async function fetchMarketPrices(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && String(v).length) qs.set(k, String(v))
  })
  const path = qs.toString() ? `/api/market/prices?${qs.toString()}` : "/api/market/prices"
  try {
    const data = await getJSON(path)
    const n = normalize(data)
    return { ...n, nextCursor: computeNextCursor(n.items) }
  } catch (err) {
    // If backend is down or route missing, try direct (no auth, CORS ok in native)
    const url = qs.toString() ? `${DIRECT_URL}?${qs.toString()}` : DIRECT_URL
    const res = await fetch(url)
    if (!res.ok) throw err
    const raw = await res.json()
    const n = normalize(raw)
    return { ...n, nextCursor: computeNextCursor(n.items) }
  }
}

function normalize(json) {
  const arr = Array.isArray(json?.products) ? json.products : []
  const base = "https://sokisho.com"
  const items = arr.map(p => ({
    id: p.id,
    title: p.commodity + (p.classification ? ` — ${p.classification}` : ""),
    commodity: p.commodity,
    classification: p.classification,
    slug: productSlug(p.commodity, p.classification),
    grade: p.grade,
    sex: p.sex,
    icon: typeof p.icon === 'string' && p.icon.startsWith('/') ? `${base}${p.icon}` : p.icon,
    market: p.market,
    county: p.county,
    wholesale: toNumber(p.wholesale_price),
    retail: toNumber(p.retail_price),
    unit: p.unit || "",
    priceDate: p.price_date,
    prevWholesale: toNumber(p.prev_wholesale_price),
    prevRetail: toNumber(p.prev_retail_price),
    wholesaleChange: typeof p.wholesale_price_change === 'number' ? p.wholesale_price_change : null,
    retailChange: typeof p.retail_price_change === 'number' ? p.retail_price_change : null,
  }))
  return { items, market: json?.market || '', country: json?.country || '' }
}

function toNumber(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function computeNextCursor(items) {
  if (!Array.isArray(items) || items.length === 0) return null
  // Assume items are ordered desc by id (as observed); use the last item's id as next lastId
  const last = items[items.length - 1]
  return last?.id ? String(last.id) : null
}
