import express from 'express'
import fs from 'fs'
import path from 'path'
import { db } from '../config/db.js'
import { mpesaTransactionsTable, mpesaB2cPaymentsTable, mpesaCallbackLogsTable, ordersTable, usersTable, productsTable } from '../db/schema.js'
import { stkPush, stkQuery, b2cPayment, transactionStatus, accountBalance, reversal, registerC2B } from '../utils/daraja.js'
import { and, eq, like, desc, gte, lte, sql } from 'drizzle-orm'
import { requireUser, getAuth } from '../middleware/auth.js'
import { sendEmail } from '../utils/email.js'

const router = express.Router()

// Helpers
function ok(res, data) { return res.status(200).json(data) }
function bad(res, code, message, extra) { return res.status(code).json({ error: message, ...extra }) }

// Normalize Kenyan MSISDN to 2547XXXXXXXX format
function normalizeMsisdn(input) {
  if (!input) return null
  let s = String(input).trim()
  if (s.startsWith('+')) s = s.slice(1)
  // Remove spaces/dashes
  s = s.replace(/[^0-9]/g, '')
  if (s.startsWith('0') && s.length === 10) s = '254' + s.slice(1)
  else if (s.startsWith('7') && s.length === 9) s = '254' + s
  // Accept already normalized 2547...
  if (/^2547\d{8}$/.test(s)) return s
  return null
}

async function requireAdmin(req, res, next) {
  try {
    const auth = getAuth(req)
    if (!auth?.userId) return res.status(401).json({ error: 'Unauthorized' })
    const rows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, auth.userId))
    const me = rows?.[0]
    if (!me || String(me.role) !== 'admin') return res.status(403).json({ error: 'Admin only' })
    return next()
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// Initiate STK Push
router.post('/mpesa/stkpush', requireUser, async (req, res) => {
  try {
    const { phone, amount, orderId, accountReference = 'SmartAgro', transactionDesc = 'Payment' } = req.body || {}
    if (!phone || !amount) return bad(res, 400, 'phone and amount required')
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return bad(res, 400, 'Invalid phone format. Use 2547XXXXXXXX')
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return bad(res, 400, 'Invalid amount')

    const apiRes = await stkPush({ phone: msisdn, amount: amt, accountReference, transactionDesc })

    // Persist transaction stub
    await db.insert(mpesaTransactionsTable).values({
      orderId: orderId || null,
      phone: String(msisdn),
      amount: String(amt),
      accountReference,
      transactionDesc,
      shortcode: process.env.MPESA_SHORTCODE || null,
      checkoutRequestId: apiRes.CheckoutRequestID || null,
      merchantRequestId: apiRes.MerchantRequestID || null,
      status: 'pending',
    })

    return ok(res, {
      message: apiRes.CustomerMessage || 'Request sent to handset',
      checkoutRequestID: apiRes.CheckoutRequestID,
      merchantRequestID: apiRes.MerchantRequestID,
    })
  } catch (e) {
    // Surface Daraja error message when available
    const cause = e?.body || undefined
    if (process.env.MPESA_DEBUG === 'true') {
      console.error('[mpesa/stkpush] error:', e?.message, cause)
    }
    return bad(res, 500, e.message || 'STK push failed', { cause })
  }
})

// Query STK status
router.get('/mpesa/stk-status/:checkoutRequestID', requireUser, async (req, res) => {
  try {
    const { checkoutRequestID } = req.params
    if (!checkoutRequestID) return bad(res, 400, 'checkoutRequestID required')
    const data = await stkQuery({ checkoutRequestID })
    return ok(res, data)
  } catch (e) {
    return bad(res, 500, e.message, { cause: e.body || undefined })
  }
})

// B2C Payout
router.post('/mpesa/b2c', requireUser, async (req, res) => {
  try {
    const { phone, amount, commandID = 'BusinessPayment', remarks = 'Payout', occasion = 'Payout' } = req.body || {}
    if (!phone || !amount) return bad(res, 400, 'phone and amount required')
    const data = await b2cPayment({ phone, amount, commandID, remarks, occasion })

    await db.insert(mpesaB2cPaymentsTable).values({
      phone: String(phone), amount: String(amount), commandId: commandID, remarks, occasion,
      shortcode: process.env.MPESA_B2C_SHORTCODE || process.env.MPESA_SHORTCODE || null,
      conversationId: data?.ConversationID || data?.OriginatorConversationID || null,
      status: 'pending', rawResult: data,
    })

    return ok(res, data)
  } catch (e) {
    return bad(res, 500, e.message, { cause: e.body || undefined })
  }
})

// Transaction Status
router.get('/mpesa/transaction-status/:transactionId', requireUser, async (req, res) => {
  try {
    const { transactionId } = req.params
    if (!transactionId) return bad(res, 400, 'transactionId required')
    const data = await transactionStatus({ transactionId })
    return ok(res, data)
  } catch (e) {
    return bad(res, 500, e.message, { cause: e.body || undefined })
  }
})

// Account Balance
router.get('/mpesa/account-balance', requireUser, async (_req, res) => {
  try {
    const data = await accountBalance({})
    return ok(res, data)
  } catch (e) {
    return bad(res, 500, e.message, { cause: e.body || undefined })
  }
})

// Reversal
router.post('/mpesa/reversal', async (req, res) => {
  try {
    const { transactionId, amount, receiverParty, receiverIdentifierType = '11', remarks = 'Reversal', occasion = 'Reversal' } = req.body || {}
    if (!transactionId || !amount || !receiverParty) return bad(res, 400, 'transactionId, amount, receiverParty required')
    const data = await reversal({ transactionId, amount, receiverParty, receiverIdentifierType, remarks, occasion })
    return ok(res, data)
  } catch (e) {
    return bad(res, 500, e.message, { cause: e.body || undefined })
  }
})

// Register C2B URLs (admin utility)
router.post('/mpesa/register-c2b', requireUser, requireAdmin, async (_req, res) => {
  try {
    const data = await registerC2B({})
    return ok(res, data)
  } catch (e) {
    return bad(res, 500, e.message, { cause: e.body || undefined })
  }
})

// =========================
// Callback endpoints
// =========================

router.post('/mpesa/callbacks/stk', async (req, res) => {
  try {
    const body = req.body || {}
    // Optional: append raw payload to JSONL file for quick offline inspection (toggle via env)
    try {
      if (process.env.MPESA_STK_JSONL === 'true') {
        const filePath = path.resolve(process.cwd(), 'data', 'stkpushresponse.jsonl')
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.appendFile(filePath, JSON.stringify(body) + '\n', () => {})
      }
    } catch {}
    await db.insert(mpesaCallbackLogsTable).values({ type: 'stk', body })

    const cb = body?.Body?.stkCallback
    const merchantRequestId = cb?.MerchantRequestID
    const checkoutRequestId = cb?.CheckoutRequestID
    const resultCode = cb?.ResultCode
    const resultDesc = cb?.ResultDesc

    let updates = { resultCode: String(resultCode), resultDesc: resultDesc || null, status: 'failed', rawCallback: body }

    // Extract metadata by Name to avoid brittle index access
    const items = cb?.CallbackMetadata?.Item || []
    const byName = {}
    for (const it of items) { if (it?.Name) byName[it.Name] = it.Value }
    if (byName.Amount != null) updates.amount = String(byName.Amount)
    if (byName.MpesaReceiptNumber) updates.mpesaReceiptNumber = String(byName.MpesaReceiptNumber)
    if (byName.TransactionDate) {
      const s = String(byName.TransactionDate)
      const year = Number(s.slice(0,4)); const mon = Number(s.slice(4,6)) - 1; const day = Number(s.slice(6,8));
      const hour = Number(s.slice(8,10)); const min = Number(s.slice(10,12)); const sec = Number(s.slice(12,14));
      updates.transactionDate = new Date(Date.UTC(year, mon, day, hour, min, sec))
    }

    if (String(resultCode) === '0') updates.status = 'success'
    else if (String(resultCode) === '1032') updates.status = 'cancelled'
    else if (String(resultCode) === '1037') updates.status = 'timeout'
    else updates.status = 'failed'

    if (checkoutRequestId) {
      // Update the mpesa transaction row
      await db.update(mpesaTransactionsTable)
        .set({ ...updates, checkoutRequestId, merchantRequestId })
        .where(eq(mpesaTransactionsTable.checkoutRequestId, checkoutRequestId))

      // If success, try to mark related order as paid
      const txRows = await db
        .select()
        .from(mpesaTransactionsTable)
        .where(eq(mpesaTransactionsTable.checkoutRequestId, checkoutRequestId))
      const tx = txRows?.[0]
      if (tx && String(resultCode) === '0' && tx.orderId) {
        // Mark order as paid; do not require manual acceptance
        await db.update(ordersTable)
          .set({ status: 'paid', updatedAt: new Date() })
          .where(eq(ordersTable.id, tx.orderId))

        // Notify the farmer that an order was paid
        try {
          // load the order and farmer id
          const ordRows = await db.select().from(ordersTable).where(eq(ordersTable.id, tx.orderId))
          const ord = ordRows?.[0]
          if (ord && ord.farmerId) {
            // create a lightweight notification
              try {
                const { createNotification } = await import('../utils/notifications.js')
                const title = 'Order paid'
                const body = `Order #${ord.id} has been paid by buyer. Please prepare to ship.`
                // Do not include a route to avoid showing an Open button in-app per request
                await createNotification(db, { userId: ord.farmerId, type: 'order_paid', title, body, data: { orderId: ord.id } })
              } catch (notifErr) {
              // swallow notification errors
            }

            // Email farmer and buyer receipts if email available
            try {
              const userRows = await db.select().from(usersTable)
              const farmer = userRows.find(u => u.id === ord.farmerId)
              const buyer = userRows.find(u => u.id === ord.buyerId)
              // Fetch product for richer receipt
              let product = null
              try {
                if (ord.productId) {
                  const pRows = await db.select().from(productsTable).where(eq(productsTable.id, ord.productId))
                  product = pRows?.[0] || null
                }
              } catch {}
              const productTitle = product?.title || 'Product'
              // Attempt to derive a displayable image URL
              let productImage = null
              try {
                const imgs = Array.isArray(product?.images) ? product.images : []
                const first = imgs?.[0]
                if (first) {
                  if (typeof first === 'string') productImage = first
                  else if (first.url) productImage = first.url
                  else if (first.displayUrl) productImage = first.displayUrl
                }
              } catch {}
              const subjectBuyer = `Thank you for your purchase (Order #${ord.id})`
              const subjectFarmer = `Payment received for Order #${ord.id}`
              const amount = Number(ord.totalAmount || 0).toFixed(2)
              const buyerName = buyer?.fullName || buyer?.username || 'Buyer'
              const farmerName = farmer?.fullName || farmer?.username || 'Farmer'
              const openUrlBase = process.env.APP_WEB_BASE_URL || process.env.PUBLIC_APP_URL || ''
              const openHref = openUrlBase ? `${openUrlBase.replace(/\/$/, '')}/orders/${ord.id}` : ''
              const textBuyer = [
                `Hi ${buyerName},`,
                '',
                `Thank you for your purchase from SmartAgro! Your order has been successfully processed. Here are the details:`,
                '----------------------------------------',
                `Order ID: ${ord.id}`,
                `Product: ${productTitle}`,
                `Quantity: ${ord.quantity}`,
                `Price: Ksh ${Number(ord.unitPrice || 0).toFixed(2)}`,
                `Total: Ksh ${amount}`,
                ord.deliveryAddress ? `Delivery Address: ${typeof ord.deliveryAddress === 'string' ? ord.deliveryAddress : JSON.stringify(ord.deliveryAddress)}` : null,
                `Farmer: ${farmerName}`,
                '----------------------------------------',
                '',
                'We will notify you once the farmer ships your product.',
                '',
                'If you have any questions, reply to this email or contact our support team at support@smartagro.com.',
                '',
                'Thank you for supporting local farmers!',
                '',
                'Best regards,',
                'SmartAgro',
                '',
                openHref ? `Open your order: ${openHref}` : null,
              ].filter(Boolean).join('\n')
              const htmlBuyer = `<div style="font-family:Arial, sans-serif;">
                <p>Hi ${buyerName},</p>
                <p>Thank you for your purchase from SmartAgro! Your order has been successfully processed. Here are the details:</p>
                <pre style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;white-space:pre-wrap;">${[
                  `Order ID: ${ord.id}`,
                  `Product: ${productTitle}`,
                  `Quantity: ${ord.quantity}`,
                  `Price: Ksh ${Number(ord.unitPrice || 0).toFixed(2)}`,
                  `Total: Ksh ${amount}`,
                  ord.deliveryAddress ? `Delivery Address: ${typeof ord.deliveryAddress === 'string' ? ord.deliveryAddress : JSON.stringify(ord.deliveryAddress)}` : null,
                  `Farmer: ${farmerName}`,
                ].filter(Boolean).join('\n')}</pre>
                <p>We will notify you once the farmer ships your product.</p>
                <p>If you have any questions, reply to this email or contact our support team at <a href="mailto:support@smartagro.com">support@smartagro.com</a>.</p>
                ${openHref ? `<p><a href="${openHref}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">Open your order</a></p>` : ''}
                <p>Thank you for supporting local farmers!</p>
                <p>Best regards,<br/>SmartAgro</p>
              </div>`
              const textFarmer = [
                `Hello ${farmerName},`,
                '',
                `You have received a payment for Order #${ord.id}.`,
                `Item: ${productTitle}`,
                `Amount: Ksh ${amount}`,
                `Quantity: ${ord.quantity}`,
                ord.paymentRef ? `M-Pesa Ref: ${ord.paymentRef}` : null,
                '',
                `Buyer: ${buyerName}${buyer?.phone ? ` · ${buyer.phone}` : ''}${buyer?.email ? ` · ${buyer.email}` : ''}`,
                ord.deliveryAddress ? `Delivery address: ${typeof ord.deliveryAddress === 'string' ? ord.deliveryAddress : JSON.stringify(ord.deliveryAddress)}` : null,
                '',
                'Please prepare the order for shipping.'
              ].filter(Boolean).join('\n')
              const htmlFarmer = `<div>
                <h3 style="margin:0 0 8px 0; font-family:Arial, sans-serif;">Payment received for Order #${ord.id}</h3>
                <p style="font-family:Arial, sans-serif;line-height:1.4;">${textFarmer.replace(/\n/g,'<br/>')}</p>
              </div>`
              if (buyer?.email) { try { await sendEmail({ to: buyer.email, subject: subjectBuyer, text: textBuyer, html: htmlBuyer, replyTo: 'support@smartagro.com' }) } catch {} }
              if (farmer?.email) { try { await sendEmail({ to: farmer.email, subject: subjectFarmer, text: textFarmer, html: htmlFarmer }) } catch {} }

              // SMS removed
            } catch {}
          }
        } catch (e) {}
      }
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (e) {
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
})

router.post('/mpesa/callbacks/result', async (req, res) => {
  try {
    const body = req.body || {}
    await db.insert(mpesaCallbackLogsTable).values({ type: 'result', body })
    // Attempt to map B2C result to a payout row
    const result = body?.Result
    const conversationId = result?.ConversationID || result?.OriginatorConversationID
    const resultCode = result?.ResultCode
    const resultDesc = result?.ResultDesc
    let transactionId = result?.TransactionID || null
    // Extract parameters by Key
    const params = result?.ResultParameters?.ResultParameter || []
    const byKey = {}
    for (const p of params) {
      if (p?.Key) byKey[p.Key] = p.Value
    }
    if (!transactionId && byKey.TransactionReceipt) transactionId = byKey.TransactionReceipt

    if (conversationId) {
      await db
        .update(mpesaB2cPaymentsTable)
        .set({
          resultCode: String(resultCode),
          resultDesc: resultDesc || null,
          transactionId: transactionId || null,
          status: String(resultCode) === '0' ? 'success' : 'failed',
          rawResult: body,
        })
        .where(eq(mpesaB2cPaymentsTable.conversationId, conversationId))
    }

    // Reversal success -> refund orders linked to original transaction
    const originalId = byKey.OriginalTransactionID || byKey.OriginalTransactionID || null
    if (originalId && String(resultCode) === '0') {
      // Update mpesa transaction row to 'refunded'
      await db.update(mpesaTransactionsTable)
        .set({ status: 'refunded' })
        .where(eq(mpesaTransactionsTable.mpesaReceiptNumber, String(originalId)))
      // Find any orders with paymentRef == originalId and mark refunded
      const paidOrders = await db.select().from(ordersTable).where(eq(ordersTable.paymentRef, String(originalId)))
      for (const ord of paidOrders) {
        await db.update(ordersTable)
          .set({ paymentStatus: 'refunded', updatedAt: new Date() })
          .where(eq(ordersTable.id, ord.id))
      }
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch {
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
})

router.post('/mpesa/callbacks/timeout', async (req, res) => {
  try {
    const body = req.body || {}
    await db.insert(mpesaCallbackLogsTable).values({ type: 'timeout', body })
    // If timeout for B2C, attempt to map and mark as timeout
    const result = body?.Result
    const conversationId = result?.ConversationID || result?.OriginatorConversationID
    if (conversationId) {
      await db
        .update(mpesaB2cPaymentsTable)
        .set({ status: 'timeout', rawResult: body })
        .where(eq(mpesaB2cPaymentsTable.conversationId, conversationId))
    }
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch {
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
})

router.post('/mpesa/c2b/confirmation', async (req, res) => {
  try {
    const body = req.body || {}
    await db.insert(mpesaCallbackLogsTable).values({ type: 'c2b_confirmation', body })
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Confirmation Received Successfully' })
  } catch {
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Confirmation Received Successfully' })
  }
})

router.post('/mpesa/c2b/validation', async (req, res) => {
  try {
    const body = req.body || {}
    await db.insert(mpesaCallbackLogsTable).values({ type: 'c2b_validation', body })
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Validation Successful' })
  } catch {
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Validation Successful' })
  }
})

// =========================
// Admin Views (lists)
// =========================

// List transactions with basic filters
router.get('/admin/mpesa/transactions', requireUser, requireAdmin, async (req, res) => {
  try {
    const { status, orderId, phone, dateFrom, dateTo, limit = '20', offset = '0' } = req.query
    const lim = Math.max(1, Math.min(200, parseInt(String(limit)) || 20))
    const off = Math.max(0, parseInt(String(offset)) || 0)
    const conds = []
    if (status) conds.push(eq(mpesaTransactionsTable.status, String(status)))
    if (orderId) conds.push(eq(mpesaTransactionsTable.orderId, Number(orderId)))
    if (phone) conds.push(like(mpesaTransactionsTable.phone, `%${String(phone)}%`))
    if (dateFrom) {
      const d = new Date(String(dateFrom))
      if (!isNaN(d.getTime())) conds.push(gte(mpesaTransactionsTable.createdAt, d))
    }
    if (dateTo) {
      const d = new Date(String(dateTo))
      if (!isNaN(d.getTime())) conds.push(lte(mpesaTransactionsTable.createdAt, d))
    }
    const whereExpr = conds.length ? and(...conds) : undefined
    const items = await db
      .select()
      .from(mpesaTransactionsTable)
      .where(whereExpr)
      .orderBy(desc(mpesaTransactionsTable.createdAt))
      .limit(lim)
      .offset(off)
    const totalRows = await db
      .select({ count: sql`count(*)` })
      .from(mpesaTransactionsTable)
      .where(whereExpr)
    const total = Number(totalRows?.[0]?.count || 0)
    return res.json({ total, limit: lim, offset: off, items })
  } catch (e) {
    return bad(res, 500, e.message)
  }
})

// List B2C payouts
router.get('/admin/mpesa/payouts', requireUser, requireAdmin, async (req, res) => {
  try {
    const { status, phone, dateFrom, dateTo, limit = '20', offset = '0' } = req.query
    const lim = Math.max(1, Math.min(200, parseInt(String(limit)) || 20))
    const off = Math.max(0, parseInt(String(offset)) || 0)
    const conds = []
    if (status) conds.push(eq(mpesaB2cPaymentsTable.status, String(status)))
    if (phone) conds.push(like(mpesaB2cPaymentsTable.phone, `%${String(phone)}%`))
    if (dateFrom) {
      const d = new Date(String(dateFrom))
      if (!isNaN(d.getTime())) conds.push(gte(mpesaB2cPaymentsTable.createdAt, d))
    }
    if (dateTo) {
      const d = new Date(String(dateTo))
      if (!isNaN(d.getTime())) conds.push(lte(mpesaB2cPaymentsTable.createdAt, d))
    }
    const whereExpr = conds.length ? and(...conds) : undefined
    const items = await db
      .select()
      .from(mpesaB2cPaymentsTable)
      .where(whereExpr)
      .orderBy(desc(mpesaB2cPaymentsTable.createdAt))
      .limit(lim)
      .offset(off)
    const totalRows = await db
      .select({ count: sql`count(*)` })
      .from(mpesaB2cPaymentsTable)
      .where(whereExpr)
    const total = Number(totalRows?.[0]?.count || 0)
    return res.json({ total, limit: lim, offset: off, items })
  } catch (e) {
    return bad(res, 500, e.message)
  }
})

// List callback logs
router.get('/admin/mpesa/callback-logs', requireUser, requireAdmin, async (req, res) => {
  try {
    const { type, dateFrom, dateTo, limit = '20', offset = '0' } = req.query
    const lim = Math.max(1, Math.min(200, parseInt(String(limit)) || 20))
    const off = Math.max(0, parseInt(String(offset)) || 0)
    const conds = []
    if (type) conds.push(eq(mpesaCallbackLogsTable.type, String(type)))
    if (dateFrom) {
      const d = new Date(String(dateFrom))
      if (!isNaN(d.getTime())) conds.push(gte(mpesaCallbackLogsTable.receivedAt, d))
    }
    if (dateTo) {
      const d = new Date(String(dateTo))
      if (!isNaN(d.getTime())) conds.push(lte(mpesaCallbackLogsTable.receivedAt, d))
    }
    const whereExpr = conds.length ? and(...conds) : undefined
    const items = await db
      .select()
      .from(mpesaCallbackLogsTable)
      .where(whereExpr)
      .orderBy(desc(mpesaCallbackLogsTable.receivedAt))
      .limit(lim)
      .offset(off)
    const totalRows = await db
      .select({ count: sql`count(*)` })
      .from(mpesaCallbackLogsTable)
      .where(whereExpr)
    const total = Number(totalRows?.[0]?.count || 0)
    return res.json({ total, limit: lim, offset: off, items })
  } catch (e) {
    return bad(res, 500, e.message)
  }
})

// Export callback logs as JSON file (default: only raw body for type=stk)
router.get('/admin/mpesa/callback-logs/export.json', requireUser, requireAdmin, async (req, res) => {
  try {
    const { type = 'stk', dateFrom, dateTo, raw = 'true', limit = '10000', offset = '0' } = req.query
    const lim = Math.max(1, Math.min(50000, parseInt(String(limit)) || 10000))
    const off = Math.max(0, parseInt(String(offset)) || 0)
    const conds = []
    if (type) conds.push(eq(mpesaCallbackLogsTable.type, String(type)))
    if (dateFrom) {
      const d = new Date(String(dateFrom))
      if (!isNaN(d.getTime())) conds.push(gte(mpesaCallbackLogsTable.receivedAt, d))
    }
    if (dateTo) {
      const d = new Date(String(dateTo))
      if (!isNaN(d.getTime())) conds.push(lte(mpesaCallbackLogsTable.receivedAt, d))
    }
    const whereExpr = conds.length ? and(...conds) : undefined
    const rows = await db
      .select()
      .from(mpesaCallbackLogsTable)
      .where(whereExpr)
      .orderBy(desc(mpesaCallbackLogsTable.receivedAt))
      .limit(lim)
      .offset(off)

    const onlyRaw = String(raw).toLowerCase() === 'true'
    const payload = onlyRaw ? rows.map(r => r.body) : rows
    const filename = type === 'stk' ? 'stkpushresponse.json' : `mpesa-callback-logs-${type}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(JSON.stringify(payload, null, 2))
  } catch (e) {
    return bad(res, 500, e.message)
  }
})

export default router
