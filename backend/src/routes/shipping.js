import { Router } from 'express'
import { db } from '../config/db.js'
import { productsTable } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const router = Router()

function haversineKm(aLat, aLng, bLat, bLng) {
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

function computeCost(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 50
  const cost = 50 + 10 * distanceKm
  return Math.round(cost * 100) / 100
}

// GET /shipping/quote?product_id=123&dest_lat=..&dest_lng=..
router.get('/shipping/quote', async (req, res) => {
  try {
    const { product_id, dest_lat, dest_lng } = req.query || {}
    const pid = Number(product_id)
    const dLat = Number(dest_lat)
    const dLng = Number(dest_lng)
    if (!Number.isInteger(pid) || !Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      return res.status(400).json({ error: 'Invalid parameters (need product_id, dest_lat, dest_lng)' })
    }
    const rows = await db.select().from(productsTable).where(eq(productsTable.id, pid))
    if (!rows.length) return res.status(404).json({ error: 'Product not found' })
    const p = rows[0]
    const pLat = Number(p.latitude)
    const pLng = Number(p.longitude)
    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) {
      return res.status(400).json({ error: 'Product missing coordinates for shipping quote' })
    }
    const km = haversineKm(pLat, pLng, dLat, dLng)
    const cost = computeCost(km)
    return res.json({ productId: pid, distanceKm: Math.round(km * 100) / 100, shippingCost: cost })
  } catch (e) {
    console.error('shipping quote error', e)
    return res.status(500).json({ error: 'failed' })
  }
})

export default router