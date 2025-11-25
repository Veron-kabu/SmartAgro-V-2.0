import { Router } from 'express'
import { db } from '../config/db.js'
import {
  usersTable,
  productsTable,
  ordersTable,
  reviewsTable,
  appSettingsTable,
  requestMetricsTable,
  mpesaTransactionsTable,
} from '../db/schema.js'
import { and, between, count, desc, eq, gte, lte, sql, sum, avg } from 'drizzle-orm'
import { ensureAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'

const router = Router()

// Minimal analytics ingestion endpoint - logs only (extend with DB/table later)
router.post('/analytics/events', async (req,res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : []
    if (!events.length) return res.json({ accepted: 0 })
    // Logging suppressed unless explicitly enabled via LOG_ANALYTICS=true
    if (process.env.LOG_ANALYTICS === 'true') {
      console.log(`📊 Analytics batch (${events.length})`, events.slice(0,5))
    }
    return res.json({ accepted: events.length })
  } catch (e) {
    console.error('analytics ingest error', e)
    res.status(500).json({ error: 'ingest_failed' })
  }
})

export default router

// ---------- Helpers ----------
function parseRange(range) {
  // Accept: 7d, 30d, 90d, ytd, all, or ISO start..end
  const now = new Date()
  const lower = String(range || '').toLowerCase()
  if (!range || lower === '30d') {
    return { start: new Date(now.getTime() - 30*24*60*60*1000), end: now }
  }
  if (lower === '7d' || lower === '1w' || lower === '1week' || lower === 'week') return { start: new Date(now.getTime() - 7*24*60*60*1000), end: now }
  if (lower === 'today') {
    const start = new Date(now)
    start.setHours(0,0,0,0)
    return { start, end: now }
  }
  if (lower === '30d' || lower === '1m' || lower === '1month' || lower === 'month') return { start: new Date(now.getTime() - 30*24*60*60*1000), end: now }
  if (lower === '90d') return { start: new Date(now.getTime() - 90*24*60*60*1000), end: now }
  if (lower === '1y' || lower === '1year' || lower === 'year') return { start: new Date(now.getTime() - 365*24*60*60*1000), end: now }
  if (lower === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1)
    return { start, end: now }
  }
  if (lower === 'all') return { start: null, end: null }
  if (lower.includes('..')) {
    const [a,b] = lower.split('..')
    const start = a ? new Date(a) : null
    const end = b ? new Date(b) : null
    return { start, end }
  }
  // Fallback: ISO start
  try { return { start: new Date(lower), end: now } } catch { return { start: null, end: null } }
}

function whereRange(col, start, end) {
  if (start && end) return between(col, start, end)
  if (start) return gte(col, start)
  if (end) return lte(col, end)
  return undefined
}

// ---------- GET /analytics/overview ----------
router.get('/analytics/overview', ensureAuth(), requireRole(['admin']), async (req,res) => {
  try {
    const { range = '30d' } = req.query
    const { start, end } = parseRange(String(range))

    // Users
    const totalUsers = await db.select({ c: count() }).from(usersTable)
    const farmers = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.role, 'farmer'))
    const buyers = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.role, 'buyer'))

    // Products
    const totalProducts = await db.select({ c: count() }).from(productsTable)

    // Orders (range-limited for revenue)
    const whereCreated = whereRange(ordersTable.createdAt, start, end)
    const deliveredWhere = whereCreated ? and(eq(ordersTable.status, 'delivered'), whereCreated) : eq(ordersTable.status, 'delivered')
    const completed = await db.select({ c: count() }).from(ordersTable).where(deliveredWhere)
    const pending = await db.select({ c: count() }).from(ordersTable).where(whereCreated ? and(sql`status in ('pending','accepted','shipped')`, whereCreated) : sql`status in ('pending','accepted','shipped')`)
    const failed = await db.select({ c: count() }).from(ordersTable).where(whereCreated ? and(sql`status in ('rejected','cancelled')`, whereCreated) : sql`status in ('rejected','cancelled')`)
    const rev = await db.select({ total: sum(ordersTable.totalAmount), avgVal: avg(ordersTable.totalAmount) }).from(ordersTable).where(deliveredWhere)

    // Reviews summary
    const reviews = await db.select({ count: count(), avg: avg(reviewsTable.rating) }).from(reviewsTable)

    // Sessions approximation: audit logs removed, return 0 for active sessions
    const activeSessions = 0

    // Uptime from settings if present
    let uptimePct = 99.9
    try {
      const up = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, 'uptimePct'))
      if (up?.[0]?.value?.pct) uptimePct = Number(up[0].value.pct)
    } catch {}

    res.json({
      users: { total: Number(totalUsers[0].c), farmers: Number(farmers[0].c), buyers: Number(buyers[0].c) },
      products: { total: Number(totalProducts[0].c) },
      transactions: {
        completed: Number(completed[0].c),
        pending: Number(pending[0].c),
        failed: Number(failed[0].c),
        revenue: Number(rev?.[0]?.total || 0),
        averageValue: Number(rev?.[0]?.avgVal || 0),
      },
      reviews: { count: Number(reviews?.[0]?.count || 0), ratingAvg: Number(reviews?.[0]?.avg || 0) },
      health: { uptimePct, activeSessions },
    })
  } catch (e) {
    console.error('overview error', e)
    res.status(500).json({ error: 'overview_failed' })
  }
})

// ---------- GET /analytics/users ----------
router.get('/analytics/users', ensureAuth(), requireRole(['admin']), async (req,res) => {
  try {
    const { range = '30d' } = req.query
    const { start, end } = parseRange(String(range))
    const total = await db.select({ c: count() }).from(usersTable)
    const farmers = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.role,'farmer'))
    const buyers = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.role,'buyer'))
    const active = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.status,'active'))
    const inactive = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.status,'inactive'))
    const suspended = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.status,'suspended'))
    const whereCreated = whereRange(usersTable.createdAt, start, end)
    const growth = await db.execute(sql`
      select date_trunc('day', ${usersTable.createdAt}) as d, count(*)::int as c
      from ${usersTable}
      ${whereCreated ? sql`where ${whereCreated}` : sql``}
      group by 1 order by 1 asc
    `)
    res.json({
      totals: { total: Number(total[0].c), farmers: Number(farmers[0].c), buyers: Number(buyers[0].c) },
      status: { active: Number(active[0].c), inactive: Number(inactive[0].c), suspended: Number(suspended[0].c) },
      growth: growth.rows.map(r => ({ date: r.d, count: Number(r.c) })),
    })
  } catch (e) {
    console.error('users analytics error', e)
    res.status(500).json({ error: 'users_failed' })
  }
})

// ---------- GET /analytics/marketplace ----------
router.get('/analytics/marketplace', ensureAuth(), requireRole(['admin']), async (req,res) => {
  try {
    const { range = '30d' } = req.query
    const { start, end } = parseRange(String(range))
    const totalProducts = await db.select({ c: count() }).from(productsTable)
    const whereRangeOrders = whereRange(ordersTable.createdAt, start, end)
    // Alias-aware date filter (cannot reuse Drizzle whereRange expression with aliased table 'o')
    const dateFilterAlias = (() => {
      if (start && end) return sql`and o.created_at between ${start} and ${end}`
      if (start) return sql`and o.created_at >= ${start}`
      if (end) return sql`and o.created_at <= ${end}`
      return sql``
    })()
    // Top categories by delivered orders
    const topCats = await db.execute(sql`
      select p.category, count(*)::int as c
      from ${ordersTable} o
      join ${productsTable} p on p.id = o.product_id
      where o.status = 'delivered' ${dateFilterAlias}
      group by p.category order by c desc limit 5
    `)
    // Top farmers by delivered sales (filter only users with role='farmer')
    const topFarmers = await db.execute(sql`
      select o.farmer_id as "farmerId",
             count(*)::int as sales,
             sum(o.total_amount::numeric)::float as revenue,
             u.email as email,
             u.username as username,
             u.full_name as full_name
      from ${ordersTable} o
      join ${usersTable} u on u.id = o.farmer_id
      where o.status = 'delivered' and u.role = 'farmer' ${dateFilterAlias}
      group by o.farmer_id, u.email, u.username, u.full_name
      order by sales desc limit 5
    `)
    // Revenue trend should reflect successful M-Pesa payments (result_code = '0')
    const txDateFilter = (() => {
      if (start && end) return sql`and coalesce(t.transaction_date, t.created_at) between ${start} and ${end}`
      if (start) return sql`and coalesce(t.transaction_date, t.created_at) >= ${start}`
      if (end) return sql`and coalesce(t.transaction_date, t.created_at) <= ${end}`
      return sql``
    })()
    const revenueTrend = await db.execute(sql`
      select date_trunc('day', coalesce(t.transaction_date, t.created_at)) as d,
             sum(t.amount::numeric)::float as revenue
      from ${mpesaTransactionsTable} t
      where t.result_code = '0' ${txDateFilter}
      group by 1 order by 1 asc
    `)
    const avgPriceTrend = await db.execute(sql`
      select date_trunc('day', ${ordersTable.createdAt}) as d, avg(${ordersTable.unitPrice})::float as avgPrice
      from ${ordersTable}
      where ${ordersTable.status}='delivered' ${whereRangeOrders ? sql`and ${whereRangeOrders}` : sql``}
      group by 1 order by 1 asc
    `)
    res.json({
      products: { total: Number(totalProducts[0].c) },
      topCategories: topCats.rows,
      topFarmers: topFarmers.rows,
      revenueTrend: revenueTrend.rows,
      avgPriceTrend: avgPriceTrend.rows,
    })
  } catch (e) {
    console.error('marketplace analytics error', e)
    res.status(500).json({ error: 'marketplace_failed' })
  }
})

// ---------- GET /analytics/transactions ----------
router.get('/analytics/transactions', ensureAuth(), requireRole(['admin']), async (req,res) => {
  try {
    const { range='30d' } = req.query
    const { start, end } = parseRange(String(range))
    const whereCreated = whereRange(ordersTable.createdAt, start, end)
    const completed = await db.select({ c: count() }).from(ordersTable).where(whereCreated ? and(eq(ordersTable.status,'delivered'), whereCreated) : eq(ordersTable.status,'delivered'))
    const pending = await db.select({ c: count() }).from(ordersTable).where(whereCreated ? and(sql`status in ('pending','accepted','shipped')`, whereCreated) : sql`status in ('pending','accepted','shipped')`)
    const failed = await db.select({ c: count() }).from(ordersTable).where(whereCreated ? and(sql`status in ('rejected','cancelled')`, whereCreated) : sql`status in ('rejected','cancelled')`)
    const rev = await db.select({ total: sum(ordersTable.totalAmount), avgVal: avg(ordersTable.totalAmount) }).from(ordersTable).where(whereCreated ? and(eq(ordersTable.status,'delivered'), whereCreated) : eq(ordersTable.status,'delivered'))
    const perDay = await db.execute(sql`
      select date_trunc('day', ${ordersTable.createdAt}) as d, count(*)::int as c
      from ${ordersTable}
      ${whereCreated ? sql`where ${whereCreated}` : sql``}
      group by 1 order by 1 asc
    `)
    // Payment methods are not tracked in schema; return empty distribution
    res.json({
      totals: {
        completed: Number(completed[0].c),
        pending: Number(pending[0].c),
        failed: Number(failed[0].c),
        revenue: Number(rev?.[0]?.total || 0),
        averageValue: Number(rev?.[0]?.avgVal || 0),
      },
      perDay: perDay.rows.map(r => ({ date: r.d, count: Number(r.c) })),
      paymentMethods: [],
      note: 'Payment method distribution unavailable (no payment method column in orders table).',
    })
  } catch (e) {
    console.error('transactions analytics error', e)
    res.status(500).json({ error: 'transactions_failed' })
  }
})
// System health and engagement analytics endpoints have been removed

// ---------- Anomalies (suspicious activity) ----------
router.get('/analytics/anomalies', ensureAuth(), requireRole(['admin']), async (req,res) => {
  try {
    // Reuse notifications table for anomaly messages, newest first
    const sinceId = Number(req.query.sinceId || 0)
    const rows = await db.execute(sql`
      select id, title, body, data, created_at
      from user_notifications
      where type = 'anomaly' ${sinceId ? sql`and id > ${sinceId}` : sql``}
      order by id desc limit 50
    `)
    res.json({ items: rows.rows })
  } catch (e) {
    console.error('anomalies fetch error', e)
    res.status(500).json({ error: 'anomalies_failed' })
  }
})

router.post('/analytics/flag-anomaly', ensureAuth(), requireRole(['admin']), async (req,res) => {
  try {
    const { title = 'Suspicious activity', body = '', data = {} } = req.body || {}
    // Resolve acting admin DB user id so notification FK is valid
    let actorDbId = null
    try {
      const urows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
      if (urows && urows.length) actorDbId = urows[0].id
    } catch (e) {}
    if (!actorDbId) {
      // If admin user not provisioned in DB, return an informative error
      return res.status(500).json({ error: 'admin_user_not_provisioned' })
    }
    const inserted = await db.execute(sql`
      insert into user_notifications (user_id, type, title, body, data)
      values (${actorDbId}, 'anomaly', ${title}, ${body}, ${JSON.stringify(data)}) returning id, created_at
    `)
    res.json({ ok: true, item: inserted.rows?.[0] })
  } catch (e) {
    console.error('flag anomaly error', e)
    res.status(500).json({ error: 'flag_failed' })
  }
})
