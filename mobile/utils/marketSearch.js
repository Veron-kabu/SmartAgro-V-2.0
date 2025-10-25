import { productSlug } from './slug'
const SEARCH_URL = 'https://sokisho.com/search_products.php'

export async function searchMarketProducts(query) {
  if (!query || !String(query).trim()) return []
  const usp = new URLSearchParams({ search: String(query).trim() })
  const url = `${SEARCH_URL}?${usp.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  const raw = await res.json()
  const arr = Array.isArray(raw) ? raw : []
  const base = 'https://sokisho.com'
  return arr.map(p => ({
    id: p.product_id ?? p.id,
    title: p.commodity + (p.classification ? ` — ${p.classification}` : ''),
    commodity: p.commodity,
    classification: p.classification,
    slug: productSlug(p.commodity, p.classification),
    icon: typeof p.icon === 'string' && p.icon.startsWith('/') ? `${base}${p.icon}` : p.icon,
    market: p.market,
    county: p.county,
    wholesale: toNumber(p.wholesale_price),
    retail: toNumber(p.retail_price),
    unit: p.unit || '',
    priceDate: p.price_date,
    wholesaleChange: toMaybeNumber(p.wholesale_price_change),
    retailChange: toMaybeNumber(p.retail_price_change),
  }))
}

function toNumber(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toMaybeNumber(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
