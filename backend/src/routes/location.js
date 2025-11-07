import { Router } from 'express'
import { db } from '../config/db.js'
import { usersTable, productsTable } from '../db/schema.js'
import { ensureAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { and, eq, gt, gte, lte, ilike } from 'drizzle-orm'
import { geocode as osmGeocode, reverseGeocode } from '../utils/nominatim.js'

const router = Router()

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

function toNumberOrNull(v) {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

function parseLatLng(rawLat, rawLng) {
  const lat = toNumberOrNull(rawLat)
  const lng = toNumberOrNull(rawLng)
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

// Bounding-box for a radius (km) around a point
function boundingBox(lat, lng, radiusKm) {
  const latDegreeKm = 110.574 // km per degree latitude
  const lngDegreeKm = 111.320 * Math.cos((lat * Math.PI) / 180)
  const dLat = radiusKm / latDegreeKm
  const dLng = radiusKm / Math.max(lngDegreeKm, 1e-6)
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  }
}

// Haversine distance in kilometers
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

async function getMe(req) {
  const rows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
  return rows[0] || null
}

// PATCH /api/location — update my location; reverse-geocode place name if omitted
router.patch('/location', ensureAuth(), async (req, res) => {
  try {
    const { lat, lng, place_name, address_details } = req.body || {}
    const pos = parseLatLng(lat, lng)
    if (!pos) return res.status(400).json({ error: 'Valid lat and lng are required' })

    let placeName = typeof place_name === 'string' && place_name.trim().length > 0 ? place_name.trim() : null
    let address = address_details && typeof address_details === 'object' ? address_details : null

    if (!placeName || !address) {
      try {
        const rev = await reverseGeocode(pos.lat, pos.lng)
        placeName = placeName || rev.placeName || null
        address = address || rev.address || null
      } catch (e) {
        // Best-effort: still save coords even if reverse fails
      }
    }

    const legacy = { lat: pos.lat, lng: pos.lng, name: placeName || null, address: address || null, updatedAt: new Date().toISOString() }

    const updated = await db
      .update(usersTable)
      .set({
        latitude: pos.lat,
        longitude: pos.lng,
        placeName: placeName || null,
        addressDetails: address || null,
        location: legacy,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.clerkUserId, req.auth.userId))
      .returning()

    if (!updated?.length) return res.status(404).json({ error: 'User not found' })
    res.json({
      latitude: Number(updated[0].latitude ?? pos.lat),
      longitude: Number(updated[0].longitude ?? pos.lng),
      place_name: updated[0].placeName || placeName || null,
      address_details: updated[0].addressDetails || address || null,
    })
  } catch (e) {
    console.error('/api/location update error:', e)
    res.status(500).json({ error: 'Failed to update location' })
  }
})

// GET /api/location/me — my stored location
router.get('/location/me', ensureAuth(), async (req, res) => {
  try {
    const me = await getMe(req)
    if (!me) return res.status(404).json({ error: 'User not found' })
    res.json({
      latitude: me.latitude ? Number(me.latitude) : null,
      longitude: me.longitude ? Number(me.longitude) : null,
      place_name: me.placeName || null,
      address_details: me.addressDetails || null,
    })
  } catch (e) {
    console.error('/api/location/me error:', e)
    res.status(500).json({ error: 'Failed to fetch location' })
  }
})

// Public helpers (rate-limited by Nominatim internal limiter)
router.get('/location/geocode', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q) return res.status(400).json({ error: 'q required' })
    const items = await osmGeocode(q, { limit: Math.min(Number(req.query.limit) || 5, 10) })
    res.json(items)
  } catch (e) {
    res.status(500).json({ error: 'Failed to geocode' })
  }
})

router.get('/location/reverse', async (req, res) => {
  try {
    const pos = parseLatLng(req.query.lat, req.query.lng)
    if (!pos) return res.status(400).json({ error: 'Valid lat & lng required' })
    const out = await reverseGeocode(pos.lat, pos.lng)
    res.json(out)
  } catch (e) {
    res.status(500).json({ error: 'Failed to reverse geocode' })
  }
})

// Nearby farmers for buyers
router.get('/location/nearby/farmers', ensureAuth(), requireRole(['buyer','admin']), async (req, res) => {
  try {
    const origin = parseLatLng(req.query.lat, req.query.lng)
    let center = origin
    if (!center) {
      const me = await getMe(req)
      if (me?.latitude != null && me?.longitude != null) {
        center = { lat: Number(me.latitude), lng: Number(me.longitude) }
      }
    }
    if (!center) return res.status(400).json({ error: 'Provide lat&lng or set your location first' })

    const radiusKm = (() => {
      const r = Number(req.query.radiusKm)
      if (!Number.isFinite(r) || r <= 0) return 25
      return Math.min(r, 200)
    })()
    const limit = (() => {
      const n = Number(req.query.limit)
      if (!Number.isFinite(n) || n <= 0) return 20
      return Math.min(n, 100)
    })()

    const box = boundingBox(center.lat, center.lng, radiusKm)
    // Filter by bounding box in SQL
    const cand = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.role, 'farmer'),
          eq(usersTable.status, 'active'),
          gte(usersTable.latitude, box.minLat),
          lte(usersTable.latitude, box.maxLat),
          gte(usersTable.longitude, box.minLng),
          lte(usersTable.longitude, box.maxLng),
        )
      )

    const results = []
    for (const u of cand) {
      const lat = toNumberOrNull(u.latitude)
      const lng = toNumberOrNull(u.longitude)
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue
      const d = haversineKm(center.lat, center.lng, lat, lng)
      if (d <= radiusKm) {
        results.push({
          id: u.id,
          fullName: u.fullName || u.username,
          username: u.username,
          profileImageUrl: u.profileImageUrl || null,
          location: { lat, lng, name: u.placeName || null, address: u.addressDetails || null },
          distanceKm: Number(d.toFixed(2)),
        })
      }
    }
    results.sort((a, b) => a.distanceKm - b.distanceKm)
    res.json(results.slice(0, limit))
  } catch (e) {
    console.error('/api/location/nearby/farmers error:', e)
    res.status(500).json({ error: 'Failed to find nearby farmers' })
  }
})

// Nearby buyers for farmers
router.get('/location/nearby/buyers', ensureAuth(), requireRole(['farmer','admin']), async (req, res) => {
  try {
    const origin = parseLatLng(req.query.lat, req.query.lng)
    let center = origin
    if (!center) {
      const me = await getMe(req)
      if (me?.latitude != null && me?.longitude != null) {
        center = { lat: Number(me.latitude), lng: Number(me.longitude) }
      }
    }
    if (!center) return res.status(400).json({ error: 'Provide lat&lng or set your location first' })

    const radiusKm = (() => {
      const r = Number(req.query.radiusKm)
      if (!Number.isFinite(r) || r <= 0) return 25
      return Math.min(r, 200)
    })()
    const limit = (() => {
      const n = Number(req.query.limit)
      if (!Number.isFinite(n) || n <= 0) return 20
      return Math.min(n, 100)
    })()

    const box = boundingBox(center.lat, center.lng, radiusKm)
    const cand = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.role, 'buyer'),
          eq(usersTable.status, 'active'),
          gte(usersTable.latitude, box.minLat),
          lte(usersTable.latitude, box.maxLat),
          gte(usersTable.longitude, box.minLng),
          lte(usersTable.longitude, box.maxLng),
        )
      )

    const results = []
    for (const u of cand) {
      const lat = toNumberOrNull(u.latitude)
      const lng = toNumberOrNull(u.longitude)
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue
      const d = haversineKm(center.lat, center.lng, lat, lng)
      if (d <= radiusKm) {
        results.push({
          id: u.id,
          fullName: u.fullName || u.username,
          username: u.username,
          profileImageUrl: u.profileImageUrl || null,
          location: { lat, lng, name: u.placeName || null, address: u.addressDetails || null },
          distanceKm: Number(d.toFixed(2)),
        })
      }
    }
    results.sort((a, b) => a.distanceKm - b.distanceKm)
    res.json(results.slice(0, limit))
  } catch (e) {
    console.error('/api/location/nearby/buyers error:', e)
    res.status(500).json({ error: 'Failed to find nearby buyers' })
  }
})

// Nearby products for buyers
router.get('/location/nearby/products', ensureAuth(), requireRole(['buyer','admin']), async (req, res) => {
  try {
    const origin = parseLatLng(req.query.lat, req.query.lng)
    let center = origin
    if (!center) {
      const me = await getMe(req)
      if (me?.latitude != null && me?.longitude != null) {
        center = { lat: Number(me.latitude), lng: Number(me.longitude) }
      }
    }
    if (!center) return res.status(400).json({ error: 'Provide lat&lng or set your location first' })

    const radiusKm = (() => {
      const r = Number(req.query.radiusKm)
      if (!Number.isFinite(r) || r <= 0) return 25
      return Math.min(r, 200)
    })()
    const limit = (() => {
      const n = Number(req.query.limit)
      if (!Number.isFinite(n) || n <= 0) return 30
      return Math.min(n, 100)
    })()
    const category = req.query.category ? String(req.query.category) : null

    const box = boundingBox(center.lat, center.lng, radiusKm)

    let whereExpr = and(
      eq(productsTable.status, 'active'),
      gt(productsTable.quantityAvailable, 0),
      gte(productsTable.latitude, box.minLat),
      lte(productsTable.latitude, box.maxLat),
      gte(productsTable.longitude, box.minLng),
      lte(productsTable.longitude, box.maxLng),
    )
    if (category) {
      // prefix category match (case-insensitive)
      whereExpr = and(whereExpr, ilike(productsTable.category, `${category}%`))
    }

    const cand = await db.select().from(productsTable).where(whereExpr)

    const results = []
    for (const p of cand) {
      const lat = toNumberOrNull(p.latitude)
      const lng = toNumberOrNull(p.longitude)
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue
      const d = haversineKm(center.lat, center.lng, lat, lng)
      if (d <= radiusKm) {
        results.push({
          id: p.id,
          title: p.title,
          price: p.price,
          unit: p.unit,
          images: p.images,
          location: { lat, lng, name: p.placeName || null, address: p.addressDetails || null },
          distanceKm: Number(d.toFixed(2)),
          farmerId: p.farmerId,
          category: p.category,
          quantityAvailable: p.quantityAvailable,
          isOrganic: !!p.isOrganic,
        })
      }
    }
    results.sort((a, b) => a.distanceKm - b.distanceKm)
    res.json(results.slice(0, limit))
  } catch (e) {
    console.error('/api/location/nearby/products error:', e)
    res.status(500).json({ error: 'Failed to find nearby products' })
  }
})

// Public: fetch a user's location by numeric id (auth required to prevent scraping)
router.get('/location/user/:id', ensureAuth(), async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id' })
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, id))
    if (!rows?.length) return res.status(404).json({ error: 'User not found' })
    const u = rows[0]
    res.json({
      id: u.id,
      role: u.role,
      location: {
        lat: u.latitude ? Number(u.latitude) : null,
        lng: u.longitude ? Number(u.longitude) : null,
        name: u.placeName || null,
        address: u.addressDetails || null,
      },
    })
  } catch (e) {
    console.error('/api/location/user/:id error:', e)
    res.status(500).json({ error: 'Failed to fetch user location' })
  }
})

export default router
