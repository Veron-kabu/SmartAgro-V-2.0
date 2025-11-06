import { Router } from 'express'
import { db } from '../config/db.js'
import { ordersTable, productsTable, usersTable } from '../db/schema.js'
import { ensureAuth } from '../middleware/auth.js'
import { eq, inArray } from 'drizzle-orm'

// Earnings & per-listing performance for farmers
// NOTE: Profit requires cost basis. We expose placeholders (null) for now; client can hide or future patch can backfill costs table.
const router = Router()

router.get('/earnings/farmer/summary', ensureAuth(), async (req,res) => {
  try {
    // Trend-related query params removed; endpoint returns summary and per-listing stats only
    // Resolve farmer DB id
    let dbUserId = req.auth?.dbUserId
    if (!dbUserId) {
      const rows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
      dbUserId = rows[0]?.id
      if (dbUserId) req.auth.dbUserId = dbUserId
    }
    if (!dbUserId) return res.status(401).json({ error: 'Unauthorized' })
    const meRows = await db.select().from(usersTable).where(eq(usersTable.id, dbUserId))
    if (meRows.length === 0 || meRows[0].role !== 'farmer') return res.status(403).json({ error: 'Not a farmer' })

    // Fetch products owned
  const prods = await db.select().from(productsTable).where(eq(productsTable.farmerId, dbUserId))
    const productIds = prods.map(p => p.id)
    let orders = []
    if (productIds.length > 0) {
      orders = await db.select().from(ordersTable).where(inArray(ordersTable.productId, productIds))
    }
    const deliveredStatuses = new Set(['delivered','completed'])
    let totalRevenue = 0
    let totalDelivered = 0
    let activeOrders = 0
    const perListing = new Map()
    for (const o of orders) {
      const amt = Number(o.totalAmount) || 0
      const st = String(o.status || '').toLowerCase()
      const isPaid = ['paid','shipped','delivered'].includes(st)
      const isRefunded = false // no refunds tracked in orders schema currently
      const entry = perListing.get(o.productId) || { productId: o.productId, orders: 0, delivered: 0, revenue: 0, qty: 0, deliveredQty: 0, paidQty: 0, unitPriceSum: 0, lastOrderAt: null }
      entry.orders += 1
      entry.qty += Number(o.quantity) || 0
      entry.unitPriceSum += Number(o.unitPrice) || 0
      if (deliveredStatuses.has(st)) {
        entry.delivered += 1
        entry.deliveredQty += Number(o.quantity) || 0
        totalDelivered += 1
      } else {
        // Count only actionable orders as 'active' (exclude cancelled/rejected)
        if (['pending','paid','shipped'].includes(st)) activeOrders += 1
      }
      // Count revenue only when paid (exclude refunded)
      if (isPaid && !isRefunded) {
        entry.revenue += amt
        if (!deliveredStatuses.has(st)) entry.paidQty += Number(o.quantity) || 0
        else {
          // delivered are also fully paid; count them under deliveredQty only for breakdown
        }
        totalRevenue += amt
        // Track last activity time per listing; use createdAt since no paidAt column
        const when = (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt))
        if (!isNaN(when)) {
          if (!entry.lastOrderAt || when > entry.lastOrderAt) entry.lastOrderAt = when
        }
      }
      perListing.set(o.productId, entry)
    }
    const listingStats = prods.map(p => {
      const s = perListing.get(p.id) || { productId: p.id, orders: 0, delivered: 0, revenue: 0, qty: 0, deliveredQty: 0, paidQty: 0, unitPriceSum: 0, lastOrderAt: null }
      const avgUnitPrice = s.unitPriceSum && s.orders ? (s.unitPriceSum / s.orders) : 0
      const availableQty = Number(p.quantityAvailable || 0)
      return {
        id: p.id,
        title: p.title,
        price: Number(p.price),
        unit: p.unit,
        status: p.status,
        orders: s.orders,
        delivered: s.delivered,
        revenue: s.revenue,
        totalQuantity: s.qty,
        deliveredQuantity: s.deliveredQty,
        paidQuantity: s.paidQty,
        availableQuantity: availableQty,
        totalUnits: s.deliveredQty + s.paidQty + availableQty,
        avgUnitPrice,
        lastOrderAt: s.lastOrderAt ? s.lastOrderAt.toISOString() : null,
        profit: null, // Placeholder until cost basis is implemented
        profitMargin: null,
      }
    })
    const activeListings = listingStats.filter(l => l.status === 'active').length
    res.json({
      currency: 'Ksh',
      totalRevenue,
      activeOrders,
      deliveredOrders: totalDelivered,
      listings: listingStats,
      activeListings,
      profit: null,
      profitMargin: null,
      loss: null,
    })
  } catch (e) {
    console.error('earnings summary error', e)
    res.status(500).json({ error: 'Failed to load earnings summary' })
  }
})

export default router