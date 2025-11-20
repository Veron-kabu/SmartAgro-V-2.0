import { Router } from 'express'
import { db } from '../config/db.js'
import { ordersTable, usersTable, productsTable, reviewsTable, orderStatusHistoryTable, mpesaTransactionsTable } from '../db/schema.js'
import { stkQuery } from '../utils/daraja.js'
import { ensureAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { requireNotSuspended } from '../middleware/status.js'
import { and, eq, inArray, gte } from 'drizzle-orm'

const router = Router()

// Simple distance calculator (Haversine) in km
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

function computeShippingCostKm(distanceKm) {
  // Base 50 KSh + 10 KSh per km (rounded to 2dp)
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 50
  const cost = 50 + 10 * distanceKm
  return Math.round(cost * 100) / 100
}

// Unified orders listing endpoint supporting buyer=me or farmer=me
router.get('/orders', ensureAuth(), async (req,res) => {
  try {
    const { buyer, farmer, limit: limitStr, offset: offsetStr } = req.query
    const isBuyerQuery = buyer === 'me'
    const isFarmerQuery = farmer === 'me'
    if (!isBuyerQuery && !isFarmerQuery) return res.status(400).json({ error: 'Specify buyer=me or farmer=me' })
    // Fetch current user
    const meArr = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (meArr.length === 0) return res.status(403).json({ error: 'Access denied' })
    const me = meArr[0]
  if (isBuyerQuery && !['buyer','farmer'].includes(me.role)) return res.status(403).json({ error: 'Not permitted (need buyer or farmer role)' })
    if (isFarmerQuery && me.role !== 'farmer') return res.status(403).json({ error: 'Not a farmer' })
    let limit = Number(limitStr); let offset = Number(offsetStr)
    if (!Number.isFinite(limit) || limit <= 0 || limit > 100) limit = 25
    if (!Number.isFinite(offset) || offset < 0) offset = 0
    let rows = []
    if (isBuyerQuery) rows = await db.select().from(ordersTable).where(eq(ordersTable.buyerId, me.id))
    else rows = await db.select().from(ordersTable).where(eq(ordersTable.farmerId, me.id))
    rows = rows.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    const pageRows = rows.slice(offset, offset + limit)
    const productIds = Array.from(new Set(pageRows.map(r => r.productId)))
    const otherUserIds = isBuyerQuery ? pageRows.map(r => r.farmerId) : pageRows.map(r => r.buyerId)
    const uniqueOtherIds = Array.from(new Set(otherUserIds))
    const orderIds = pageRows.map(r => r.id)
    const [products, counterpartUsers] = await Promise.all([
      productIds.length ? db.select().from(productsTable).where(inArray(productsTable.id, productIds)) : Promise.resolve([]),
      uniqueOtherIds.length ? db.select().from(usersTable).where(inArray(usersTable.id, uniqueOtherIds)) : Promise.resolve([]),
    ])
    let myReviews = []
    if (isBuyerQuery && orderIds.length) {
      myReviews = await db.select().from(reviewsTable).where(and(eq(reviewsTable.reviewerId, me.id), inArray(reviewsTable.orderId, orderIds)))
    }
    const productMap = new Map(products.map(p => [p.id, p]))
    const counterpartMap = new Map(counterpartUsers.map(u => [u.id, u]))
    const reviewMap = new Map(myReviews.map(r => [r.orderId, r]))
    const result = pageRows.map(o => ({
      id: o.id,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paidAt: o.paidAt,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      hasReview: isBuyerQuery ? reviewMap.has(o.id) : undefined,
      reviewRating: isBuyerQuery ? (reviewMap.get(o.id)?.rating ?? null) : undefined,
      product: (() => {
        const p = productMap.get(o.productId)
        if (!p) return { id: o.productId, title: null, price: null, unit: null, imageUrl: null, imageBlurhash: null }
        const thumbs = Array.isArray(p.thumbnails) ? p.thumbnails : []
        const imgs = Array.isArray(p.images) ? p.images : []
        const hashes = Array.isArray(p.imageBlurhashes) ? p.imageBlurhashes : []
        const firstUrl = (thumbs[0] || imgs[0]) || null
        const firstHash = (hashes[0]) || null
        return { id: p.id, title: p.title, price: p.price, unit: p.unit, imageUrl: firstUrl, imageBlurhash: firstHash }
      })(),
      // Provide consistent counterpart object key: farmer / buyer
      ...(isBuyerQuery ? { farmer: (() => { const f = counterpartMap.get(o.farmerId); return f ? { id: f.id, fullName: f.fullName || f.username } : { id: o.farmerId, fullName: null } })() }
        : { buyer: (() => { const b = counterpartMap.get(o.buyerId); return b ? { id: b.id, fullName: b.fullName || b.username } : { id: o.buyerId, fullName: null } })() })
    }))
    res.json({ items: result, total: rows.length, limit, offset })
  } catch (e) { console.error('Error fetching orders:', e); res.status(500).json({ error: 'Failed to fetch orders' }) }
})

// Allow farmers to also act as buyers when purchasing products from other farmers
router.post('/orders', ensureAuth(), requireNotSuspended(), requireRole(['buyer','farmer']), async (req,res) => {
  try {
    const buyer = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    const { product_id, quantity, delivery_address, notes } = req.body
    const destLat = req.body?.dest_lat ?? req.body?.delivery_lat ?? req.body?.latitude
    const destLng = req.body?.dest_lng ?? req.body?.delivery_lng ?? req.body?.longitude
    if (!product_id || !quantity || !delivery_address) return res.status(400).json({ error: 'Missing required order fields' })
    const product = await db.select().from(productsTable).where(and(eq(productsTable.id, product_id), eq(productsTable.status, 'active')))
    if (product.length === 0) return res.status(404).json({ error: 'Product not found or not available' })
    // Prevent ordering own listing if farmer is ordering
    if (buyer[0].role === 'farmer' && product[0].farmerId === buyer[0].id) {
      return res.status(400).json({ error: 'Cannot order your own product' })
    }
    if (product[0].quantityAvailable < quantity) return res.status(400).json({ error: 'Insufficient quantity available' })
    // Idempotency guard: if a recent pending order exists for same buyer+product, return it
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
      const recent = await db
        .select()
        .from(ordersTable)
        .where(and(
          eq(ordersTable.buyerId, buyer[0].id),
          eq(ordersTable.productId, product_id),
          eq(ordersTable.status, 'pending'),
          gte(ordersTable.createdAt, oneMinuteAgo),
        ))
      if (recent.length) {
        return res.json({ ...recent[0], remainingQuantity: product[0].quantityAvailable, productStatus: product[0].status })
      }
    } catch {}
    const productTotal = Number(product[0].price) * quantity
    let shippingCost = 0
    try {
      const pLat = Number(product[0].latitude)
      const pLng = Number(product[0].longitude)
      const dLat = Number(destLat)
      const dLng = Number(destLng)
      if (Number.isFinite(pLat) && Number.isFinite(pLng) && Number.isFinite(dLat) && Number.isFinite(dLng)) {
        const km = haversineKm(pLat, pLng, dLat, dLng)
        shippingCost = computeShippingCostKm(km)
      }
    } catch {}
    const finalTotal = productTotal + shippingCost
    // Attempt atomic-like update (optimistic concurrency) to decrement stock and set status when depleted
    const originalQty = product[0].quantityAvailable
    const nextQty = originalQty - quantity
    const updateFields = { quantityAvailable: nextQty, updatedAt: new Date() }
    if (nextQty <= 0) {
      updateFields.status = 'sold'
    }
    const updatedProduct = await db.update(productsTable)
      .set(updateFields)
      .where(and(eq(productsTable.id, product_id), eq(productsTable.quantityAvailable, originalQty)))
      .returning()
    if (updatedProduct.length === 0) {
      // Stock changed between read & update
      return res.status(409).json({ error: 'Stock changed, please retry order' })
    }
    const inserted = await db.insert(ordersTable).values({
      buyerId: buyer[0].id,
      farmerId: product[0].farmerId,
      productId: product_id,
      quantity,
      unitPrice: product[0].price,
      totalAmount: finalTotal,
      shippingCost: shippingCost,
      deliveryAddress: delivery_address,
      notes,
    }).returning()
    // record initial status history
    await db.insert(orderStatusHistoryTable).values({
      orderId: inserted[0].id,
      fromStatus: null,
      toStatus: inserted[0].status,
      changedByUserId: buyer[0].id,
    })
    res.json({ ...inserted[0], remainingQuantity: nextQty, productStatus: updateFields.status || product[0].status, shippingCost })
  } catch (e) { console.error('Error creating order:', e); res.status(500).json({ error: 'Failed to create order' }) }
})

// Create an order only AFTER successful M-Pesa payment.
// Client flow: initiate STK without orderId -> poll success -> call this with checkoutRequestID
router.post('/orders/after-payment', ensureAuth(), requireNotSuspended(), requireRole(['buyer','farmer']), async (req, res) => {
  try {
    const meArr = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (!meArr.length) return res.status(403).json({ error: 'Access denied' })
    const me = meArr[0]
    const { product_id, quantity, delivery_address, notes, checkoutRequestID } = req.body || {}
    const destLat = req.body?.dest_lat ?? req.body?.delivery_lat ?? req.body?.latitude
    const destLng = req.body?.dest_lng ?? req.body?.delivery_lng ?? req.body?.longitude
    if (!product_id || !quantity || !delivery_address || !checkoutRequestID) {
      return res.status(400).json({ error: 'Missing required fields (product_id, quantity, delivery_address, checkoutRequestID)' })
    }
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' })
    // Resolve product snapshot
    const prodArr = await db.select().from(productsTable).where(and(eq(productsTable.id, product_id), eq(productsTable.status, 'active')))
    if (!prodArr.length) return res.status(404).json({ error: 'Product not found or not available' })
    const product = prodArr[0]
    if (me.role === 'farmer' && product.farmerId === me.id) {
      return res.status(400).json({ error: 'Cannot order your own product' })
    }
    if (product.quantityAvailable < qty) return res.status(400).json({ error: 'Insufficient quantity available' })

    // Compute effective unit price with discount and round to 2dp
    const basePrice = Number(product.price)
    const discountPercent = Number(product.discountPercent || 0)
    const effectiveUnit = discountPercent > 0
      ? Math.round((basePrice * (1 - discountPercent / 100)) * 100) / 100
      : Math.round(basePrice * 100) / 100
    const productTotal = Math.round((effectiveUnit * qty) * 100) / 100
    let shippingCost = 0
    try {
      const pLat = Number(product.latitude)
      const pLng = Number(product.longitude)
      const dLat = Number(destLat)
      const dLng = Number(destLng)
      if (Number.isFinite(pLat) && Number.isFinite(pLng) && Number.isFinite(dLat) && Number.isFinite(dLng)) {
        const km = haversineKm(pLat, pLng, dLat, dLng)
        shippingCost = computeShippingCostKm(km)
      }
    } catch {}
    const totalAmount = Math.round((productTotal + shippingCost) * 100) / 100

    // Verify STK payment success and integrity
    const txArr = await db.select().from(mpesaTransactionsTable).where(eq(mpesaTransactionsTable.checkoutRequestId, String(checkoutRequestID)))
    const tx = txArr[0]
    if (!tx) return res.status(400).json({ error: 'Payment session not found' })
    if (tx.orderId) return res.status(400).json({ error: 'Payment already used for another order' })
    // As an extra guard, query live status if we don't have a success yet
    let isSuccess = String(tx.resultCode || '').toLowerCase() === '0' || String(tx.status || '') === 'success'
    if (!isSuccess) {
      try {
        const q = await stkQuery({ checkoutRequestID: String(checkoutRequestID) })
        const rc = String(q?.ResultCode ?? '')
        if (rc === '0') isSuccess = true
      } catch {}
    }
    if (!isSuccess) return res.status(400).json({ error: 'Payment not confirmed' })
    // Amount match (use numeric compare)
    const paid = Number(tx.amount)
    if (!Number.isFinite(paid) || Math.abs(paid - totalAmount) > 0.01) {
      return res.status(400).json({ error: 'Paid amount does not match order total' })
    }
    // Optional: verify phone belongs to current user
    const mePhone = (me.phone || '').replace(/[^0-9]/g, '')
    const txPhone = (tx.phone || '').replace(/[^0-9]/g, '')
    if (mePhone && txPhone && !txPhone.endsWith(mePhone.slice(-9))) {
      return res.status(403).json({ error: 'Payment phone does not match your profile' })
    }

    // Decrement stock atomically (optimistic)
    const originalQty = product.quantityAvailable
    const nextQty = originalQty - qty
    const updateFields = { quantityAvailable: nextQty, updatedAt: new Date() }
    if (nextQty <= 0) updateFields.status = 'sold'
    const updatedProduct = await db.update(productsTable)
      .set(updateFields)
      .where(and(eq(productsTable.id, product_id), eq(productsTable.quantityAvailable, originalQty)))
      .returning()
    if (!updatedProduct.length) {
      return res.status(409).json({ error: 'Stock changed, please retry order' })
    }

    // Create order as paid
    const inserted = await db.insert(ordersTable).values({
      buyerId: me.id,
      farmerId: product.farmerId,
      productId: product.id,
      quantity: qty,
  unitPrice: String(effectiveUnit),
  totalAmount: String(totalAmount),
      shippingCost: String(shippingCost),
      deliveryAddress: delivery_address,
      notes,
      status: 'paid',
    }).returning()

    const order = inserted[0]
    // Link the mpesa tx to order to prevent reuse
    try {
      await db.update(mpesaTransactionsTable).set({ orderId: order.id }).where(eq(mpesaTransactionsTable.id, tx.id))
    } catch {}
    // Record history
    try {
      await db.insert(orderStatusHistoryTable).values({ orderId: order.id, fromStatus: null, toStatus: 'paid', changedByUserId: me.id })
    } catch {}

    return res.json({ ...order, remainingQuantity: nextQty, productStatus: updateFields.status || product.status, shippingCost })
  } catch (e) {
    console.error('after-payment order error', e)
    return res.status(500).json({ error: 'Failed to create order after payment' })
  }
})

// Create multiple orders (cart) after a single successful M-Pesa payment.
// Body: { items: [{ product_id, quantity, delivery_address, notes }], checkoutRequestID }
router.post('/orders/cart-after-payment', ensureAuth(), requireNotSuspended(), requireRole(['buyer','farmer']), async (req, res) => {
  try {
    const meArr = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (!meArr.length) return res.status(403).json({ error: 'Access denied' })
    const me = meArr[0]
    const { items, checkoutRequestID } = req.body || {}
    const destLat = req.body?.dest_lat ?? req.body?.delivery_lat ?? req.body?.latitude
    const destLng = req.body?.dest_lng ?? req.body?.delivery_lng ?? req.body?.longitude
    if (!Array.isArray(items) || items.length === 0 || !checkoutRequestID) {
      return res.status(400).json({ error: 'Missing required fields (items[], checkoutRequestID)' })
    }
    // Normalize items
    const safeItems = items.map(it => ({
      product_id: Number(it.product_id || it.id),
      quantity: Number(it.quantity || 0),
      delivery_address: it.delivery_address || null,
      notes: it.notes || null,
    })).filter(it => Number.isInteger(it.product_id) && Number.isInteger(it.quantity) && it.quantity > 0)
    if (safeItems.length === 0) return res.status(400).json({ error: 'No valid items' })

    // Fetch products
    const prodIds = Array.from(new Set(safeItems.map(i => i.product_id)))
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, prodIds))
    const pmap = new Map(products.map(p => [p.id, p]))

    // Compute total expected amount with discounts
    let grandTotal = 0
    for (const it of safeItems) {
      const p = pmap.get(it.product_id)
      if (!p || p.status !== 'active') return res.status(400).json({ error: `Product ${it.product_id} unavailable` })
      if (me.role === 'farmer' && p.farmerId === me.id) return res.status(400).json({ error: 'Cannot order your own product' })
      if (p.quantityAvailable < it.quantity) return res.status(400).json({ error: `Insufficient quantity for product ${p.id}` })
      const base = Number(p.price)
      const disc = Number(p.discountPercent || 0)
      const unit = disc > 0 ? Math.round((base * (1 - disc / 100)) * 100) / 100 : Math.round(base * 100) / 100
      grandTotal += unit * it.quantity
    }
    
    // Compute shipping once for the entire cart (bulk) using first product's location as origin
    let cartShipping = 0
    try {
      const firstProduct = pmap.get(safeItems[0].product_id)
      const pLat = Number(firstProduct.latitude)
      const pLng = Number(firstProduct.longitude)
      const dLat = Number(destLat)
      const dLng = Number(destLng)
      if (Number.isFinite(pLat) && Number.isFinite(pLng) && Number.isFinite(dLat) && Number.isFinite(dLng)) {
        const km = haversineKm(pLat, pLng, dLat, dLng)
        cartShipping = computeShippingCostKm(km)
      }
    } catch {}
    grandTotal = Math.round((grandTotal + cartShipping) * 100) / 100

    // Verify payment transaction and amount
    const txArr = await db.select().from(mpesaTransactionsTable).where(eq(mpesaTransactionsTable.checkoutRequestId, String(checkoutRequestID)))
    const tx = txArr[0]
    if (!tx) return res.status(400).json({ error: 'Payment session not found' })
    if (tx.orderId) return res.status(400).json({ error: 'Payment already linked to an order' })
    let isSuccess = String(tx.resultCode || '').toLowerCase() === '0' || String(tx.status || '') === 'success'
    if (!isSuccess) {
      try { const q = await stkQuery({ checkoutRequestID: String(checkoutRequestID) }); const rc = String(q?.ResultCode ?? ''); if (rc === '0') isSuccess = true } catch {}
    }
    if (!isSuccess) return res.status(400).json({ error: 'Payment not confirmed' })
    const paid = Number(tx.amount)
    if (!Number.isFinite(paid) || Math.abs(paid - grandTotal) > 0.01) {
      return res.status(400).json({ error: 'Paid amount does not match cart total' })
    }

    // Create orders one by one with optimistic stock decrement
    // Split shipping proportionally across items (or assign to first item for simplicity)
    const itemCount = safeItems.length
    const shippingPerItem = itemCount > 0 ? Math.round((cartShipping / itemCount) * 100) / 100 : 0
    const created = []
    for (let idx = 0; idx < safeItems.length; idx++) {
      const it = safeItems[idx]
      const p = pmap.get(it.product_id)
      const base = Number(p.price)
      const disc = Number(p.discountPercent || 0)
      const unit = disc > 0 ? Math.round((base * (1 - disc / 100)) * 100) / 100 : Math.round(base * 100) / 100
      const productTotal = Math.round((unit * it.quantity) * 100) / 100
      // Assign proportional shipping to each order
      const itemShipping = shippingPerItem
      const total = Math.round((productTotal + itemShipping) * 100) / 100
      
      // Decrement stock
      const originalQty = p.quantityAvailable
      const nextQty = originalQty - it.quantity
      const updateFields = { quantityAvailable: nextQty, updatedAt: new Date() }
      if (nextQty <= 0) updateFields.status = 'sold'
      const updatedProduct = await db.update(productsTable)
        .set(updateFields)
        .where(and(eq(productsTable.id, p.id), eq(productsTable.quantityAvailable, originalQty)))
        .returning()
      if (!updatedProduct.length) return res.status(409).json({ error: 'Stock changed, please retry order' })

      const inserted = await db.insert(ordersTable).values({
        buyerId: me.id,
        farmerId: p.farmerId,
        productId: p.id,
        quantity: it.quantity,
        unitPrice: String(unit),
        totalAmount: String(total),
        shippingCost: String(itemShipping),
        deliveryAddress: it.delivery_address,
        notes: it.notes,
        status: 'paid',
      }).returning()
      const order = inserted[0]
      created.push(order)
      try { await db.insert(orderStatusHistoryTable).values({ orderId: order.id, fromStatus: null, toStatus: 'paid', changedByUserId: me.id }) } catch {}
      // Refresh pmap quantities for subsequent items of same product
      p.quantityAvailable = nextQty
      if (updateFields.status) p.status = updateFields.status
    }

    // Link transaction to first created order (one-to-many not modeled; this prevents re-use)
    try { if (created[0]) await db.update(mpesaTransactionsTable).set({ orderId: created[0].id }).where(eq(mpesaTransactionsTable.id, tx.id)) } catch {}

    return res.json({ ok: true, orders: created })
  } catch (e) {
    console.error('cart-after-payment error', e)
    return res.status(500).json({ error: 'Failed to create cart orders after payment' })
  }
})

// Patch order status (farmer/admin). Accept both /:id/status and plain /:id for flexibility.
router.patch('/orders/:id/status', ensureAuth(), requireNotSuspended({ allowAdminBypass: true }), requireRole(['farmer','admin']), async (req,res) => {
  try {
    const orderId = Number(req.params.id)
    const { status } = req.body
  const validStatuses = ['pending','paid','shipped','delivered','cancelled','paused']
    if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' })
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status value' })
    const existing = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId))
    if (existing.length === 0) return res.status(404).json({ error: 'Order not found' })
    const prevStatus = existing[0].status
    // Restrict 'delivered' to buyer flow only (farmers cannot mark delivered)
    if (req.userRole !== 'admin' && String(status).toLowerCase() === 'delivered') {
      return res.status(403).json({ error: 'Only the buyer can mark an order as delivered' })
    }
  const updated = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, orderId)).returning()
    if (updated.length === 0) return res.status(404).json({ error: 'Order not found' })
    const actor = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (actor.length) {
      await db.insert(orderStatusHistoryTable).values({
        orderId: orderId,
        fromStatus: prevStatus,
        toStatus: status,
        changedByUserId: actor[0].id,
      })
    }
    res.json(updated[0])
  } catch (e) { console.error('Error updating order status:', e); res.status(500).json({ error: 'Failed to update order status' }) }
})

// Buyer marks an order as delivered (single-purpose endpoint)
router.post('/orders/:id/mark-delivered', ensureAuth(), requireNotSuspended(), async (req,res) => {
  try {
    const orderId = Number(req.params.id)
    if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' })
    // Resolve db user id
    let dbUserId = req.auth?.dbUserId
    if (!dbUserId) {
      const rows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
      dbUserId = rows[0]?.id
      if (dbUserId) req.auth.dbUserId = dbUserId
    }
    if (!dbUserId) return res.status(401).json({ error: 'Unauthorized' })
    const existing = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId))
    if (existing.length === 0) return res.status(404).json({ error: 'Order not found' })
    const ord = existing[0]
    if (ord.buyerId !== dbUserId) return res.status(403).json({ error: 'Only the buyer can mark this order as delivered' })
    const current = String(ord.status || '').toLowerCase()
    if (current !== 'shipped') return res.status(400).json({ error: 'Order must be shipped before it can be marked delivered' })
    const updatedArr = await db.update(ordersTable).set({ status: 'delivered', updatedAt: new Date() }).where(eq(ordersTable.id, orderId)).returning()
    // Record history
    await db.insert(orderStatusHistoryTable).values({ orderId, fromStatus: ord.status, toStatus: 'delivered', changedByUserId: dbUserId })
    return res.json({ ok: true, order: updatedArr[0] })
  } catch (e) {
    console.error('mark-delivered error', e)
    return res.status(500).json({ error: 'Failed to mark delivered' })
  }
})

router.patch('/orders/:id', ensureAuth(), requireNotSuspended({ allowAdminBypass: true }), requireRole(['farmer','admin']), async (req,res) => {
  try {
    const orderId = Number(req.params.id)
    const { status } = req.body || {}
  const validStatuses = ['pending','paid','shipped','delivered','cancelled','paused']
    if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' })
    if (typeof status === 'undefined') return res.status(400).json({ error: 'No updatable fields supplied' })
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status value' })
    const existing = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId))
    if (existing.length === 0) return res.status(404).json({ error: 'Order not found' })
    const prevStatus = existing[0].status
    const updated = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, orderId)).returning()
    const actor = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (actor.length) {
      await db.insert(orderStatusHistoryTable).values({
        orderId: orderId,
        fromStatus: prevStatus,
        toStatus: status,
        changedByUserId: actor[0].id,
      })
    }
    res.json(updated[0])
  } catch (e) { console.error('Error updating order (compat route):', e); res.status(500).json({ error: 'Failed to update order' }) }
})

// Buyer-initiated cancellation: allowed only when order is still pending and the requester is the buyer
router.post('/orders/:id/cancel', ensureAuth(), requireNotSuspended(), requireRole(['buyer','farmer']), async (req, res) => {
  try {
    const orderId = Number(req.params.id)
    if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' })
    // Current user
    const meArr = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (!meArr.length) return res.status(403).json({ error: 'Access denied' })
    const me = meArr[0]
    // Fetch order
    const existingArr = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId))
    if (!existingArr.length) return res.status(404).json({ error: 'Order not found' })
    const existing = existingArr[0]
    // Only the buyer who created it can cancel
    if (existing.buyerId !== me.id) return res.status(403).json({ error: 'Only the buyer can cancel this order' })
    const current = (existing.status || '').toLowerCase()
    if (current !== 'pending') return res.status(400).json({ error: 'Order cannot be cancelled at this stage' })

    // Update status -> cancelled
    const updatedArr = await db.update(ordersTable).set({ status: 'cancelled' }).where(eq(ordersTable.id, orderId)).returning()
    const updated = updatedArr[0]
    // Record history
    await db.insert(orderStatusHistoryTable).values({
      orderId: orderId,
      fromStatus: existing.status,
      toStatus: 'cancelled',
      changedByUserId: me.id,
    })
    return res.json(updated)
  } catch (e) {
    console.error('Error cancelling order:', e)
    return res.status(500).json({ error: 'Failed to cancel order' })
  }
})

// Order detail with history (buyer or farmer of the order or admin)
router.get('/orders/:id', ensureAuth(), async (req,res) => {
  try {
    const orderId = Number(req.params.id)
    if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid order ID' })
    const meArr = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (!meArr.length) return res.status(403).json({ error: 'Access denied' })
    const me = meArr[0]
    const orderArr = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId))
    if (!orderArr.length) return res.status(404).json({ error: 'Order not found' })
    const order = orderArr[0]
    if (me.role !== 'admin' && me.id !== order.buyerId && me.id !== order.farmerId) return res.status(403).json({ error: 'Forbidden' })
    const [productArr, buyerArr, farmerArr, history] = await Promise.all([
      db.select().from(productsTable).where(eq(productsTable.id, order.productId)),
      db.select().from(usersTable).where(eq(usersTable.id, order.buyerId)),
      db.select().from(usersTable).where(eq(usersTable.id, order.farmerId)),
      db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, orderId)),
    ])
    const product = productArr[0]
    const buyer = buyerArr[0]
    const farmer = farmerArr[0]
    history.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))
    res.json({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      product: product ? (() => {
        const thumbs = Array.isArray(product.thumbnails) ? product.thumbnails : []
        const imgs = Array.isArray(product.images) ? product.images : []
        const hashes = Array.isArray(product.imageBlurhashes) ? product.imageBlurhashes : []
        const firstUrl = (thumbs[0] || imgs[0]) || null
        const firstHash = (hashes[0]) || null
        return { id: product.id, title: product.title, unit: product.unit, price: product.price, imageUrl: firstUrl, imageBlurhash: firstHash }
      })() : null,
      buyer: buyer ? { id: buyer.id, fullName: buyer.fullName || buyer.username } : null,
      farmer: farmer ? { id: farmer.id, fullName: farmer.fullName || farmer.username } : null,
      history: history.map(h => ({ id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, changedByUserId: h.changedByUserId, createdAt: h.createdAt }))
    })
  } catch (e) { console.error('Error fetching order detail:', e); res.status(500).json({ error: 'Failed to fetch order detail' }) }
})

export default router