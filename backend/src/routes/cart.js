import { Router } from 'express'
import { db } from '../config/db.js'
import { cartTable, productsTable, usersTable } from '../db/schema.js'
import { ensureAuth, clerkClient } from '../middleware/auth.js'
import { and, eq, inArray } from 'drizzle-orm'

const router = Router()

// Resolve (and cache) DB user id from Clerk auth (copied from favorites.js)
async function resolveDbUserId(req) {
  if (req.auth?.dbUserId) return req.auth.dbUserId
  if (!req.auth?.userId) return null
  const rows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
  let id = rows[0]?.id || null
  if (!id) {
    try {
      const user = await clerkClient.users.getUser(req.auth.userId)
      const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || `unknown+${req.auth.userId}@example.com`
      const baseUsername = user?.username || (email ? email.split('@')[0] : 'user')
      const roleMeta = (user?.publicMetadata?.role || user?.privateMetadata?.role || '').toString()
      const role = ['buyer','farmer','admin'].includes(roleMeta) ? roleMeta : 'buyer'
      let username = baseUsername.toLowerCase()
      if (rows.some(r => r.username === username)) {
        username = `${username}_${Date.now().toString(36).slice(-4)}`
      }
      const inserted = await db.insert(usersTable).values({
        clerkUserId: req.auth.userId,
        username,
        email,
        role,
        fullName: user?.fullName || user?.firstName || null,
        status: 'active'
      }).returning()
      id = inserted[0]?.id || null
    } catch (e) {
      console.error('Auto-provision user failed:', e)
    }
  }
  if (id) req.auth.dbUserId = id
  return id
}

// Add item to cart (increments existing quantity if present)
router.post('/cart', ensureAuth(), async (req, res) => {
  try {
    const userId = await resolveDbUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { productId, quantity = 1, unitPrice = null, metadata = {} } = req.body || {}
    const pid = Number(productId)
    const qty = Number(quantity) || 1
    if (!pid || Number.isNaN(pid)) return res.status(400).json({ error: 'Invalid product id' })
    if (qty <= 0) return res.status(400).json({ error: 'Quantity must be at least 1' })

    const prod = await db.select().from(productsTable).where(eq(productsTable.id, pid))
    if (!prod || prod.length === 0) return res.status(404).json({ error: 'Product not found' })

    // Check existing cart row for this user+product
    const existing = await db.select().from(cartTable).where(and(eq(cartTable.userId, userId), eq(cartTable.productId, pid)))
    if (existing.length > 0) {
      const newQty = (Number(existing[0].quantity) || 0) + qty
      const updated = await db.update(cartTable).set({ quantity: newQty, updatedAt: new Date(), unitPrice, metadata }).where(eq(cartTable.id, existing[0].id)).returning()
      return res.json({ id: updated[0].id, quantity: updated[0].quantity })
    }

    const inserted = await db.insert(cartTable).values({ userId, productId: pid, quantity: qty, unitPrice, metadata }).returning()
    res.json({ id: inserted[0].id, quantity: inserted[0].quantity })
  } catch (e) {
    console.error('cart add error', e)
    res.status(500).json({ error: 'Failed to add to cart' })
  }
})

// List cart items for current user (enriched with product snapshot)
router.get('/cart', ensureAuth(), async (req, res) => {
  try {
    const userId = await resolveDbUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const rows = await db.select().from(cartTable).where(eq(cartTable.userId, userId))
    if (!rows || rows.length === 0) return res.json([])
    const productIds = Array.from(new Set(rows.map(r => r.productId)))
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds))
    const productMap = new Map(products.map(p => [p.id, p]))
    const result = rows.map(r => {
      const p = productMap.get(r.productId)
      if (!p) return { id: r.id, quantity: r.quantity, productDeleted: true, product: { id: r.productId, deleted: true } }
      return {
        id: r.id,
        quantity: r.quantity,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        metadata: r.metadata,
        product: {
          id: p.id,
          title: p.title,
          price: p.price,
          unit: p.unit,
          images: p.images,
          location: p.location,
          farmerId: p.farmerId,
          quantityAvailable: p.quantityAvailable,
          status: p.status,
          discountPercent: p.discountPercent,
          isOrganic: p.isOrganic
        }
      }
    })
    res.json(result)
  } catch (e) {
    console.error('cart list error', e)
    res.status(500).json({ error: 'Failed to fetch cart' })
  }
})

// Update cart quantity by cart row id
router.patch('/cart/:id', ensureAuth(), async (req, res) => {
  try {
    const userId = await resolveDbUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const id = Number(req.params.id)
    const { quantity } = req.body || {}
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'Invalid cart id' })
    const qty = Number(quantity)
    if (Number.isNaN(qty)) return res.status(400).json({ error: 'Invalid quantity' })
    const existing = await db.select().from(cartTable).where(eq(cartTable.id, id))
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Cart item not found' })
    if (existing[0].userId !== userId) return res.status(403).json({ error: 'Forbidden' })
    if (qty <= 0) {
      await db.delete(cartTable).where(eq(cartTable.id, id))
      return res.json({ deleted: true })
    }
    const updated = await db.update(cartTable).set({ quantity: qty, updatedAt: new Date() }).where(eq(cartTable.id, id)).returning()
    res.json({ id: updated[0].id, quantity: updated[0].quantity })
  } catch (e) {
    console.error('cart update error', e)
    res.status(500).json({ error: 'Failed to update cart' })
  }
})

// Remove cart item
router.delete('/cart/:id', ensureAuth(), async (req, res) => {
  try {
    const userId = await resolveDbUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const id = Number(req.params.id)
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'Invalid cart id' })
    const existing = await db.select().from(cartTable).where(eq(cartTable.id, id))
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Cart item not found' })
    if (existing[0].userId !== userId) return res.status(403).json({ error: 'Forbidden' })
    await db.delete(cartTable).where(eq(cartTable.id, id))
    res.json({ deleted: true })
  } catch (e) {
    console.error('cart delete error', e)
    res.status(500).json({ error: 'Failed to delete cart item' })
  }
})

export default router
