import { Router } from 'express'

// Simple in-memory cache: key -> { expiresAt, data }
const cache = new Map()

const SOKISHO_URL = 'https://sokisho.com/get_products.php'
const ICON_BASE = 'https://sokisho.com'

function buildCacheKey(query = {}) {
  // Stable key regardless of param order
  const entries = Object.entries(query).filter(([k,v]) => v != null && String(v).length > 0)
  entries.sort(([a],[b]) => a.localeCompare(b))
  return JSON.stringify(entries)
}

async function safeFetchJson(url, { timeoutMs = 15000, signal } = {}) {
  // Try up to 2 attempts, with increasing timeouts, to ride out slow upstreams
  const timeouts = [timeoutMs, Math.max(timeoutMs * 1.7, 25000)]
  for (let attempt = 0; attempt < timeouts.length; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeouts[attempt])
    try {
      const res = await fetch(url, { signal: signal || ctrl.signal })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        const err = new Error(`Upstream request failed: ${res.status} ${res.statusText}`)
        err.status = res.status
        err.body = txt
        throw err
      }
      return await res.json()
    } catch (e) {
      const aborted = e && (e.name === 'AbortError' || String(e).includes('AbortError'))
      if (aborted && attempt < timeouts.length - 1) {
        // retry with longer timeout
        continue
      }
      throw e
    } finally {
      clearTimeout(t)
    }
  }
}

function normalizeProducts(json) {
  const arr = Array.isArray(json?.products) ? json.products : []
  const normalized = arr.map((p) => {
    const icon = typeof p.icon === 'string' && p.icon.startsWith('/') ? `${ICON_BASE}${p.icon}` : (p.icon || null)
    return {
      id: p.id,
      slug: p.slug,
      commodity: p.commodity,
      classification: p.classification,
      grade: p.grade,
      sex: p.sex,
      icon,
      market: p.market,
      county: p.county,
      wholesale_price: p.wholesale_price != null ? String(p.wholesale_price) : null,
      retail_price: p.retail_price != null ? String(p.retail_price) : null,
      unit: p.unit || null,
      price_date: p.price_date,
      prev_wholesale_price: p.prev_wholesale_price,
      prev_retail_price: p.prev_retail_price,
      prev_price_date: p.prev_price_date,
      wholesale_price_change: Number.isFinite(Number(p.wholesale_price_change)) ? Number(p.wholesale_price_change) : null,
      retail_price_change: Number.isFinite(Number(p.retail_price_change)) ? Number(p.retail_price_change) : null,
      created_at: p.created_at,
    }
  })
  return { products: normalized, market: json?.market || '', country: json?.country || '' }
}

const router = Router()

// GET /api/market/prices?commodity=&market=&county=&limit=
router.get('/market/prices', async (req, res) => {
  try {
    const { commodity, market, county, limit, lastId, country } = req.query || {}

    // Build upstream URL with supported params (passthrough)
    const usp = new URLSearchParams()
    if (commodity) usp.set('commodity', String(commodity))
    if (market) usp.set('market', String(market))
    if (county) usp.set('county', String(county))
  if (limit) usp.set('limit', String(limit))
  if (lastId) usp.set('lastId', String(lastId))
  if (country) usp.set('country', String(country))

    const upstream = usp.toString() ? `${SOKISHO_URL}?${usp.toString()}` : SOKISHO_URL

    // Cache key on our normalized param set, not full URL
  const key = buildCacheKey({ commodity, market, county, limit, lastId, country })
    const now = Date.now()
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now) {
      return res.json(cached.data)
    }

    const raw = await safeFetchJson(upstream, { timeoutMs: 12000 })
    const data = normalizeProducts(raw)

    // Default cache TTL: 10 minutes (prices are daily; adjust easily via env later)
    cache.set(key, { data, expiresAt: now + 10 * 60 * 1000 })
    res.json(data)
  } catch (e) {
    try { console.error('[market/prices] error', e) } catch {}
    res.status(502).json({ error: 'Failed to fetch market prices' })
  }
})

export default router
