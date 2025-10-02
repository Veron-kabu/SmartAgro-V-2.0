import { Router } from 'express'
import { db } from '../config/db.js'
import { favoritesTable, messagesTable, reviewsTable, usersTable, productsTable, ordersTable, marketDataTable, clerkSyncRunsTable } from '../db/schema.js'
import { syncClerkUsers } from '../utils/clerkSync.js'
import { ensureAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { and, eq, inArray, desc, sql } from 'drizzle-orm'

const router = Router()

// Reviews
router.post('/reviews', ensureAuth(), requireRole(['buyer']), async (req,res) => {
  try {
    const { order_id, rating, comment } = req.body || {}
    const orderId = Number(order_id); const score = Number(rating)
    if (!orderId || isNaN(orderId)) return res.status(400).json({ error: 'Valid order_id is required' })
    if (!Number.isFinite(score) || score < 1 || score > 5) return res.status(400).json({ error: 'rating must be between 1 and 5' })
    const me = await db.select().from(usersTable).where(and(eq(usersTable.clerkUserId, req.auth.userId), eq(usersTable.role, 'buyer')))
    if (me.length === 0) return res.status(403).json({ error: 'Access denied' })
    const ord = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId))
    if (ord.length === 0) return res.status(404).json({ error: 'Order not found' })
    if (ord[0].buyerId !== me[0].id) return res.status(403).json({ error: 'Cannot review someone else\'s order' })
    const okStatuses = ['delivered','completed']
    if (!okStatuses.includes((ord[0].status || '').toLowerCase())) return res.status(400).json({ error: 'Order not delivered; cannot review yet' })
    const inserted = await db.insert(reviewsTable).values({ orderId, reviewerId: me[0].id, reviewedId: ord[0].farmerId, rating: score, comment: comment || null }).returning()
    res.json(inserted[0])
  } catch (e) { console.error('Error creating review:', e); res.status(500).json({ error: 'Failed to create review' }) }
})

router.get('/reviews', ensureAuth(), async (req,res) => {
  try {
    const { buyer, order_id } = req.query || {}
    let reviewerId = null
    if (buyer === 'me') {
      const me = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
      if (me.length === 0) return res.status(403).json({ error: 'Access denied' })
      reviewerId = me[0].id
    }
    const whereClauses = []
    if (reviewerId) whereClauses.push(eq(reviewsTable.reviewerId, reviewerId))
    if (order_id) { const oid = Number(order_id); if (!Number.isFinite(oid)) return res.status(400).json({ error: 'Invalid order_id' }); whereClauses.push(eq(reviewsTable.orderId, oid)) }
    let reviews = []
    if (whereClauses.length > 0) { const predicate = whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses); reviews = await db.select().from(reviewsTable).where(predicate) } else { reviews = await db.select().from(reviewsTable) }
    if (reviews.length === 0) return res.json([])
    const farmerIds = Array.from(new Set(reviews.map(r => r.reviewedId)))
    const farmers = await db.select().from(usersTable).where(inArray(usersTable.id, farmerIds))
    const farmerMap = new Map(farmers.map(f => [f.id, f]))
    const result = reviews.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(r => ({ id: r.id, orderId: r.orderId, rating: r.rating, comment: r.comment, createdAt: r.createdAt, farmer: (() => { const f = farmerMap.get(r.reviewedId); return f ? { id: f.id, fullName: f.fullName || f.username } : { id: r.reviewedId, fullName: null } })() }))
    res.json(result)
  } catch (e) { console.error('Error fetching reviews:', e); res.status(500).json({ error: 'Failed to fetch reviews' }) }
})


// Messages
router.post('/messages', ensureAuth(), requireRole(['buyer','farmer','admin']), async (req,res) => {
  try {
    const sender = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (sender.length === 0) return res.status(403).json({ error: 'Sender not found' })
    const { receiver_id, order_id, message } = req.body
    if (!receiver_id || isNaN(Number(receiver_id)) || !message || typeof message !== 'string' || message.trim() === '') return res.status(400).json({ error: 'Valid receiver ID and non-empty message are required' })
    const receiver = await db.select().from(usersTable).where(eq(usersTable.id, receiver_id))
    if (receiver.length === 0) return res.status(404).json({ error: 'Receiver not found' })
    if (order_id) { const order = await db.select().from(ordersTable).where(eq(ordersTable.id, order_id)); if (order.length === 0) return res.status(404).json({ error: 'Order not found' }) }
    const inserted = await db.insert(messagesTable).values({ senderId: sender[0].id, receiverId: receiver_id, orderId: order_id || null, message }).returning()
    res.json(inserted[0])
  } catch (e) { console.error('Error sending message:', e); res.status(500).json({ error: 'Failed to send message' }) }
})

// Dashboard (farmer)
router.get('/dashboard/farmer', ensureAuth(), requireRole(['farmer']), async (req,res) => {
  try {
    const farmer = await db.select().from(usersTable).where(and(eq(usersTable.clerkUserId, req.auth.userId), eq(usersTable.role, 'farmer')))
    if (farmer.length === 0) return res.status(403).json({ error: 'Access denied' })
  const products = await db.select().from(productsTable).where(eq(productsTable.farmerId, farmer[0].id))
  const activeProducts = products.filter(p => p.status === 'active')
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.farmerId, farmer[0].id))
    const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((s,o) => s + Number.parseFloat(o.totalAmount), 0)
  res.json({ totalProducts: activeProducts.length, activeOrders: orders.filter(o => ['pending','accepted'].includes(o.status)).length, totalRevenue: totalRevenue.toFixed(2), recentProducts: activeProducts.slice(0,5), recentOrders: orders.slice(0,5) })
  } catch (e) { console.error('Error fetching farmer dashboard:', e); res.status(500).json({ error: 'Failed to fetch dashboard data' }) }
})

// Stats overview
router.get('/stats/overview', ensureAuth(), async (req,res) => {
  try {
    const meArr = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (meArr.length === 0) return res.status(404).json({ error: 'User not found' })
    const me = meArr[0]
    const isFarmer = me.role === 'farmer'; const isBuyer = me.role === 'buyer'
    // Messages (received only counts for unread/total)
    const received = await db.select().from(messagesTable).where(eq(messagesTable.receiverId, me.id))
    const unreadMessages = received.filter(m => !m.isRead).length
    const totalMessages = received.length
    const activeStatuses = ['pending','accepted','shipped']
    const deliveredStatuses = ['delivered','completed']
    let ordersPrimary = [] // farmer incoming OR buyer orders
    let ordersSent = []    // only populated for farmers (orders placed as buyer)
    if (isFarmer) {
      // Incoming orders where this user is the farmer
      ordersPrimary = await db.select().from(ordersTable).where(eq(ordersTable.farmerId, me.id))
      // Sent orders (farmer acting as buyer) - reuse existing table; some farmers may not have any
      ordersSent = await db.select().from(ordersTable).where(eq(ordersTable.buyerId, me.id))
    } else if (isBuyer) {
      ordersPrimary = await db.select().from(ordersTable).where(eq(ordersTable.buyerId, me.id))
    }
    // Compute stats helper
    function summarize(list) {
      if (!list || list.length === 0) return { total: 0, active: 0, delivered: 0 }
      const active = list.filter(o => activeStatuses.includes((o.status || '').toLowerCase())).length
      const delivered = list.filter(o => deliveredStatuses.includes((o.status || '').toLowerCase())).length
      return { total: list.length, active, delivered }
    }
    const ordersSummary = summarize(ordersPrimary)
    const ordersSentSummary = isFarmer ? summarize(ordersSent) : null
    let totalProducts = null
    if (isFarmer) {
      const prods = await db.select().from(productsTable).where(eq(productsTable.farmerId, me.id))
      totalProducts = prods.filter(p => p.status === 'active').length
    }
    res.json({
      role: me.role,
      messages: { unread: unreadMessages, total: totalMessages },
      orders: ordersSummary,
      ordersSent: ordersSentSummary,
      products: { total: totalProducts }
    })
  } catch (e) { console.error('stats overview error', e); res.status(500).json({ error: 'Failed to load stats' }) }
})

// Market data
router.get('/market-data', async (req,res) => {
  try {
    const { category, location, season } = req.query
    let query = db.select().from(marketDataTable)
    if (category) query = query.where(eq(marketDataTable.category, category))
    if (location) query = query.where(eq(marketDataTable.location, location))
    if (season) query = query.where(eq(marketDataTable.season, season))
    const data = await query
    res.json(data)
  } catch (e) { console.error('Error fetching market data:', e); res.status(500).json({ error: 'Failed to fetch market data' }) }
})

// =============================
// Clerk Sync Operational Endpoints
// =============================
router.get('/admin/clerk-sync-status', ensureAuth(), requireRole(['admin']), async (req,res) => {
  try {
    const [latest] = await db.select().from(clerkSyncRunsTable).orderBy(desc(clerkSyncRunsTable.id)).limit(1)
    const [{ count: dbUserCount }] = await db.execute(sql`SELECT COUNT(*)::int as count FROM users`)
    res.json({ latestRun: latest || null, dbUserCount })
  } catch (e) {
    console.error('clerk-sync-status error', e)
    res.status(500).json({ error: 'Failed to load sync status' })
  }
})

router.post('/admin/clerk-sync-run', ensureAuth(), requireRole(['admin']), async (req,res) => {
  try {
    const { dryRun = false, logDiffs = false, verbose = false } = req.body || {}
    const result = await syncClerkUsers({ dryRun, logDiffs, verbose, source: 'api' })
    res.json(result)
  } catch (e) {
    console.error('clerk-sync-run error', e)
    res.status(500).json({ error: 'Failed to run clerk sync' })
  }
})

export default router