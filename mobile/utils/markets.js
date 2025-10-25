const MARKETS_URL = 'https://sokisho.com/get_markets.php?country=Kenya'

export async function fetchMarkets() {
  const res = await fetch(MARKETS_URL)
  if (!res.ok) throw new Error(`Failed to load markets: ${res.status}`)
  const arr = await res.json()
  if (!Array.isArray(arr)) return []
  return arr.map(m => ({
    name: String(m.market_name || '').trim(),
    county: String(m.county_district || '').trim(),
    country: String(m.country || '').trim(),
    featured: String(m.featured || '').trim().toLowerCase() === 'yes',
  }))
}
