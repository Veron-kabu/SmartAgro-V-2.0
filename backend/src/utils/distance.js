export function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = d => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h))
  return R * c
}

export function computeShippingCost(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 50
  const cost = 50 + 10 * distanceKm
  return Math.round(cost * 100) / 100
}