import { Router } from 'express'
import express from 'express'
import { db } from '../config/db.js'
import {
  usersTable,
  ordersTable,
  orderStatusHistoryTable,
  productsTable,
  favoritesTable,
  cartTable,
  reviewsTable,
  reviewCommentsTable,
  userReportsTable,
  reportAppealsTable,
  userVerificationTable,
  verificationSubmissionsTable,
  verificationStatusHistoryTable,
  uploadTokensTable,
  userNotificationsTable,
  auditLogsTable,
  mpesaTransactionsTable,
  verificationAppealsTable,
} from '../db/schema.js'
import { ensureAuth, clerkClient } from '../middleware/auth.js'
import { handleUserCreated } from './webhooks.js'
import { requireRole } from '../middleware/role.js'
import { ENV } from '../config/env.js'
import { eq, and, or, inArray, desc, sql } from 'drizzle-orm'
import { createNotification } from '../utils/notifications.js'
import { requireNotSuspended } from '../middleware/status.js'

const router = Router()

// Note: server.js skips global JSON parser for /api/users/profile to allow larger bodies.
// Apply JSON parsing only to routes that actually need it (e.g., PATCH), not for GET.

// Create user
router.post('/users', ensureAuth(), async (req, res) => {
  try {
    const existingUser = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (existingUser.length > 0) return res.json(existingUser[0])
  const { username, email, role, full_name, phone } = req.body || {}
    if (!username || !email) return res.status(400).json({ error: 'username and email are required' })
    const allowed = ['buyer','farmer']
    const safeRole = allowed.includes(role) ? role : 'buyer'
    let emailVerified = false
    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId)
      const primaryEmailObj = clerkUser?.emailAddresses?.find(e => e.id === clerkUser?.primaryEmailAddressId) || clerkUser?.emailAddresses?.[0]
      emailVerified = (primaryEmailObj?.verification?.status === 'verified') || false
    } catch { emailVerified = false }
    const rawLoc = req.body.location || null
    const lat = req.body.latitude ?? rawLoc?.lat ?? rawLoc?.latitude
    const lng = req.body.longitude ?? rawLoc?.lng ?? rawLoc?.longitude
    const place_name = req.body.place_name ?? rawLoc?.name ?? rawLoc?.placeName
    const address_details = req.body.address_details ?? rawLoc?.address ?? rawLoc?.addressDetails

    const inserted = await db.insert(usersTable).values({
      clerkUserId: req.auth.userId,
      username,
      email,
      role: safeRole,
      fullName: full_name,
      phone,
      latitude: typeof lat !== 'undefined' ? Number(lat) : null,
      longitude: typeof lng !== 'undefined' ? Number(lng) : null,
      placeName: typeof place_name === 'string' ? place_name : null,
      addressDetails: (address_details && typeof address_details === 'object') ? address_details : null,
      // Backward-compat cache
      location: (lat != null && lng != null) ? { lat: Number(lat), lng: Number(lng), name: place_name || null, address: address_details || null } : null,
      emailVerified,
    }).returning()
    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId)
      const current = (clerkUser && clerkUser.unsafeMetadata) || {}
      if (current.role !== safeRole) {
        await clerkClient.users.updateUser(req.auth.userId, { unsafeMetadata: { ...current, role: safeRole } })
      }
    } catch (e) { console.warn('Failed to set Clerk metadata role on user creation:', e) }
    res.json(inserted[0])
  } catch (error) {
    console.error('Error creating user:', error)
    res.status(500).json({ error: 'Failed to create user' })
  }
})

export default router

// Get profile
router.get('/users/profile', ensureAuth(), async (req, res) => {
  const DEBUG = process.env.PROFILE_DEBUG === 'true'
  try {
    const clerkId = req.auth.userId
    if (DEBUG) console.log(`[profile] GET /api/users/profile for ${clerkId}`)
    let rows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkId))
    if (rows.length === 0) {
      // Auto-provision from Clerk if missing (fallback if webhook missed)
      try {
        const clerkUser = await clerkClient.users.getUser(clerkId)
        if (clerkUser) {
          await handleUserCreated(clerkUser)
          rows = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkId))
        }
      } catch (provisionErr) {
        console.warn('[profile] auto-provision failed:', provisionErr?.message || provisionErr)
      }
    }
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' })
    return res.json(rows[0])
  } catch (e) {
    console.error('Error fetching user profile:', e)
    return res.status(500).json({ error: 'Failed to fetch user' })
  }
})



// Update profile (large body)
router.patch('/users/profile', ensureAuth(), requireNotSuspended(), express.json({ limit: '25mb', type: 'application/json' }), async (req,res) => {
  try {
    const me = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (me.length === 0) return res.status(404).json({ error: 'User not found' })
  const { username, email, full_name, phone, profile_image_url, profile_image_blurhash, banner_image_url, banner_image_blurhash } = req.body || {}
    if (typeof username === 'string' && username.trim()) {
      const taken = await db.select().from(usersTable).where(eq(usersTable.username, username.trim()))
      if (taken.length > 0 && taken[0].id !== me[0].id) return res.status(409).json({ error: 'conflict', field: 'username', message: 'Username already taken' })
    }
    if (typeof email === 'string' && email.trim()) {
      const emailNorm = email.trim()
      const taken = await db.select().from(usersTable).where(eq(usersTable.email, emailNorm))
      if (taken.length > 0 && taken[0].id !== me[0].id) return res.status(409).json({ error: 'conflict', field: 'email', message: 'Email already in use' })
    }
    const updates = {}
    if (typeof username !== 'undefined') updates.username = username?.trim() || null
    if (typeof email !== 'undefined') updates.email = email?.trim() || null
    if (typeof full_name !== 'undefined') updates.fullName = full_name || null
    if (typeof phone !== 'undefined') updates.phone = phone || null
    // Normalize optional location fields; prefer using /api/location endpoint for reverse geocoding + save
    const rawLoc = req.body.location || null
    const lat = req.body.latitude ?? rawLoc?.lat ?? rawLoc?.latitude
    const lng = req.body.longitude ?? rawLoc?.lng ?? rawLoc?.longitude
    const place_name = req.body.place_name ?? rawLoc?.name ?? rawLoc?.placeName
    const address_details = req.body.address_details ?? rawLoc?.address ?? rawLoc?.addressDetails
    if (lat != null && lng != null) {
      const latNum = Number(lat)
      const lngNum = Number(lng)
      if (Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
        updates.latitude = latNum
        updates.longitude = lngNum
        if (typeof place_name === 'string') updates.placeName = place_name
        if (address_details && typeof address_details === 'object') updates.addressDetails = address_details
        updates.location = {
          lat: latNum,
          lng: lngNum,
          name: typeof place_name === 'string' ? place_name : (me[0].placeName || null),
          address: (address_details && typeof address_details === 'object') ? address_details : (me[0].addressDetails || null),
        }
      }
    }
    if (typeof profile_image_url !== 'undefined') {
      const { AWS_S3_BUCKET, AWS_S3_REGION, AWS_CLOUDFRONT_DOMAIN } = ENV
      const allowlistHosts = []
      if (AWS_S3_BUCKET && AWS_S3_REGION) allowlistHosts.push(`${AWS_S3_BUCKET}.s3.${AWS_S3_REGION}.amazonaws.com`)
      if (AWS_CLOUDFRONT_DOMAIN) allowlistHosts.push(AWS_CLOUDFRONT_DOMAIN)
      const val = profile_image_url || null
      if (val === null) updates.profileImageUrl = null
      else if (allowlistHosts.length === 0) updates.profileImageUrl = val
      else {
        try {
          const u = new URL(val)
          if (!allowlistHosts.includes(u.host)) return res.status(400).json({ error: 'Invalid image URL host' })
          // Strip any query/fragments (avoid storing presigned GET URLs)
          updates.profileImageUrl = `${u.protocol}//${u.host}${u.pathname}`
        } catch { return res.status(400).json({ error: 'Invalid image URL' }) }
      }
    }
    if (typeof profile_image_blurhash !== 'undefined') updates.profileImageBlurhash = profile_image_blurhash || null
    // Banner fields (optional)
    if (typeof banner_image_url !== 'undefined') {
      const { AWS_S3_BUCKET, AWS_S3_REGION, AWS_CLOUDFRONT_DOMAIN } = ENV
      const allowlistHosts = []
      if (AWS_S3_BUCKET && AWS_S3_REGION) allowlistHosts.push(`${AWS_S3_BUCKET}.s3.${AWS_S3_REGION}.amazonaws.com`)
      if (AWS_CLOUDFRONT_DOMAIN) allowlistHosts.push(AWS_CLOUDFRONT_DOMAIN)
      const val = banner_image_url || null
      if (val === null) updates.bannerImageUrl = null
      else if (allowlistHosts.length === 0) updates.bannerImageUrl = val
      else {
        try {
          const u = new URL(val)
          if (!allowlistHosts.includes(u.host)) return res.status(400).json({ error: 'Invalid banner URL host' })
          // Strip any query/fragments (avoid storing presigned GET URLs)
          updates.bannerImageUrl = `${u.protocol}//${u.host}${u.pathname}`
        } catch { return res.status(400).json({ error: 'Invalid banner URL' }) }
      }
    }
    if (typeof banner_image_blurhash !== 'undefined') updates.bannerImageBlurhash = banner_image_blurhash || null
    updates.updatedAt = new Date()
    const updated = await db.update(usersTable).set(updates).where(eq(usersTable.clerkUserId, req.auth.userId)).returning()
    return res.json(updated[0])
  } catch (error) {
    console.error('Error updating user profile:', error)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// Public-ish fetch user by numeric ID (no auth required for basic public profile fields)
router.get('/users/:id', async (req, res) => {
  try {
    const idNum = Number(req.params.id)
    if (isNaN(idNum)) return res.status(400).json({ error: 'Invalid user id' })
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, idNum))
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' })
    const u = rows[0]
    // Limit fields to a safe public subset
    return res.json({
      id: u.id,
      username: u.username,
      full_name: u.fullName,
      role: u.role,
      is_trusted: !!u.isTrusted,
      rating_avg: Number(u.ratingAvg || 0),
      rating_count: u.ratingCount || 0,
      profile_image_url: u.profileImageUrl,
      profile_image_blurhash: u.profileImageBlurhash,
      banner_image_url: u.bannerImageUrl,
      location: u.location,
      created_at: u.createdAt,
    })
  } catch (e) {
    console.error('Error fetching user by id:', e)
    return res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// export the router at the end of the file

// Admin-only user status endpoints
router.post('/admin/users/:id/suspend', ensureAuth(), requireRole(['admin']), async (req, res) => {
  try {
    const idNum = Number(req.params.id)
    if (isNaN(idNum)) return res.status(400).json({ error: 'invalid id' })
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, idNum))
    if (rows.length === 0) return res.status(404).json({ error: 'not found' })
    // Determine acting admin db id for history entries
    let adminId = null
    try {
      const meArr = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
      adminId = meArr?.[0]?.id || null
    } catch {}
    const updated = await db.update(usersTable).set({ status: 'suspended', updatedAt: new Date() }).where(eq(usersTable.id, idNum)).returning()

    // Pause ongoing orders for this user (as buyer or farmer)
    try {
      const activeStatuses = ['pending','accepted','shipped']
      const affected = await db.update(ordersTable)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(and(inArray(ordersTable.status, activeStatuses), or(eq(ordersTable.buyerId, idNum), eq(ordersTable.farmerId, idNum))))
        .returning()
      if (affected?.length && adminId) {
        for (const ord of affected) {
          await db.insert(orderStatusHistoryTable).values({
            orderId: ord.id,
            fromStatus: null, // unknown previous here; full history still tracks earlier state
            toStatus: 'paused',
            changedByUserId: adminId,
          })
        }
      }
    } catch (e) { console.warn('pause orders on suspend failed', e?.message || e) }

    // Notify user about suspension
    try {
      await createNotification(db, {
        userId: idNum,
        type: 'account_suspended',
        title: 'Account suspended',
        body: 'Your account has been suspended. You cannot place orders, mark deliveries, post reviews or comments, or create/edit listings until reactivated.',
        data: { route: '/appeals' }
      })
    } catch {}

    return res.json({ ok: true, user: updated[0] })
  } catch (e) {
    console.error('suspend error', e)
    return res.status(500).json({ error: 'failed' })
  }
})

router.post('/admin/users/:id/unsuspend', ensureAuth(), requireRole(['admin']), async (req, res) => {
  try {
    const idNum = Number(req.params.id)
    if (isNaN(idNum)) return res.status(400).json({ error: 'invalid id' })
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, idNum))
    if (rows.length === 0) return res.status(404).json({ error: 'not found' })
    // Determine acting admin db id for history entries
    let adminId = null
    try {
      const meArr = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
      adminId = meArr?.[0]?.id || null
    } catch {}
    const updated = await db.update(usersTable).set({ status: 'active', updatedAt: new Date() }).where(eq(usersTable.id, idNum)).returning()

    // Resume paused orders for this user by restoring last non-paused status
    try {
      // Fetch all paused orders
      const pausedOrders = await db.select().from(ordersTable).where(and(eq(ordersTable.status, 'paused'), or(eq(ordersTable.buyerId, idNum), eq(ordersTable.farmerId, idNum))))
      for (const ord of pausedOrders) {
        // Find the last history entry whose toStatus != 'paused'
        let prevStatus = 'pending'
        try {
          const allHist = await db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, ord.id))
          // order newest first and find first non-paused
          allHist.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
          const prior = allHist.find(h => String(h.toStatus).toLowerCase() !== 'paused')
          if (prior && prior.toStatus) prevStatus = prior.toStatus
        } catch {}
        const updatedOrder = await db.update(ordersTable).set({ status: prevStatus, updatedAt: new Date() }).where(eq(ordersTable.id, ord.id)).returning()
        if (adminId && updatedOrder?.[0]) {
          await db.insert(orderStatusHistoryTable).values({
            orderId: ord.id,
            fromStatus: 'paused',
            toStatus: prevStatus,
            changedByUserId: adminId,
          })
        }
      }
    } catch (e) { console.warn('resume orders on unsuspend failed', e?.message || e) }

    // Notify about reactivation
    try {
      await createNotification(db, {
        userId: idNum,
        type: 'account_reactivated',
        title: 'Account reactivated',
        body: 'Your account has been reactivated. You can now resume normal activity.'
      })
    } catch {}

    return res.json({ ok: true, user: updated[0] })
  } catch (e) {
    console.error('unsuspend error', e)
    return res.status(500).json({ error: 'failed' })
  }
})

router.post('/admin/users/:id/ban', ensureAuth(), requireRole(['admin']), async (req, res) => {
  try {
    const idNum = Number(req.params.id)
    if (isNaN(idNum)) return res.status(400).json({ error: 'invalid id' })
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, idNum))
    if (rows.length === 0) return res.status(404).json({ error: 'not found' })
    const updated = await db.update(usersTable).set({ status: 'inactive', updatedAt: new Date() }).where(eq(usersTable.id, idNum)).returning()
    return res.json({ ok: true, user: updated[0] })
  } catch (e) {
    console.error('ban error', e)
    return res.status(500).json({ error: 'failed' })
  }
})

// Admin: toggle trusted badge (manual only)
router.post('/admin/users/:id/trust', ensureAuth(), requireRole(['admin']), async (req, res) => {
  try {
    const idNum = Number(req.params.id)
    const { trusted } = req.body || {}
    if (isNaN(idNum)) return res.status(400).json({ error: 'invalid id' })
    if (typeof trusted !== 'boolean') return res.status(400).json({ error: 'trusted must be boolean' })
    const exists = await db.select().from(usersTable).where(eq(usersTable.id, idNum))
    if (!exists.length) return res.status(404).json({ error: 'not found' })
    const updated = await db.update(usersTable).set({ isTrusted: trusted, updatedAt: new Date() }).where(eq(usersTable.id, idNum)).returning()
    return res.json({ ok: true, user: updated[0] })
  } catch (e) {
    console.error('trust toggle error', e)
    return res.status(500).json({ error: 'failed' })
  }
})

// Admin: list users (simple, paginated, supports search)
router.get('/admin/users', ensureAuth(), requireRole(['admin']), async (req, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit || 50))
    const offset = Number(req.query.offset || 0)
    const q = req.query.q ? String(req.query.q).trim() : null
    let rows
    if (q) {
      const like = `%${q}%`
      rows = await db.execute(sql`
        select id, username, email, role, status, full_name as fullName, created_at
        from users
        where username ilike ${like} or email ilike ${like}
        order by id desc
        limit ${limit} offset ${offset}
      `)
    } else {
      rows = await db.execute(sql`
        select id, username, email, role, status, full_name as fullName, created_at
        from users
        order by id desc
        limit ${limit} offset ${offset}
      `)
    }
    return res.json({ items: rows.rows || [], limit, offset })
  } catch (e) {
    console.error('admin users list error', e)
    return res.status(500).json({ error: 'failed' })
  }
})

// Admin: soft-delete user (marks status as 'deleted')
router.delete('/admin/users/:id', ensureAuth(), requireRole(['admin']), async (req, res) => {
  try {
    const idNum = Number(req.params.id)
    if (isNaN(idNum)) return res.status(400).json({ error: 'invalid id' })
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, idNum))
    if (!rows.length) return res.status(404).json({ error: 'not found' })
    const userRow = rows[0]
    const clerkId = userRow.clerkUserId

    // Attempt to mark Clerk user as deleted (prevent re-provision) and delete from Clerk if possible
    if (clerkId) {
      try {
        // Mark unsafe metadata flag so webhooks / ensureDbUser won't re-create the DB row
        await clerkClient.users.updateUser(clerkId, { unsafeMetadata: { deleted: true } })
      } catch (e) {
        console.warn('Failed to set Clerk unsafeMetadata.deleted flag (continuing):', e?.message || e)
      }
      try {
        // Attempt to fully delete the Clerk user (best-effort)
        if (typeof clerkClient.users.deleteUser === 'function') {
          await clerkClient.users.deleteUser(clerkId)
        } else if (typeof clerkClient.users.adminDeleteUser === 'function') {
          await clerkClient.users.adminDeleteUser(clerkId)
        }
      } catch (e) {
        // Non-fatal: we already set the deleted flag; continue with DB cleanup
        console.warn('Failed to delete Clerk user (continuing):', e?.message || e)
      }
    }

    // Perform a transactional hard-delete of user and related rows to avoid FK constraint errors
    await db.transaction(async (tx) => {
      const uid = idNum

      // 1) Orders (as buyer or farmer) and related payments/history
      const userOrders = await tx.select().from(ordersTable).where(or(eq(ordersTable.buyerId, uid), eq(ordersTable.farmerId, uid)))
      const orderIds = userOrders.map(o => o.id)
      if (orderIds.length) {
        try { await tx.delete(mpesaTransactionsTable).where(inArray(mpesaTransactionsTable.orderId, orderIds)) } catch {}
        try { await tx.delete(orderStatusHistoryTable).where(inArray(orderStatusHistoryTable.orderId, orderIds)) } catch {}
        try { await tx.delete(ordersTable).where(inArray(ordersTable.id, orderIds)) } catch {}
      }

      // 2) Products owned by user (as farmer) and related resources
      const products = await tx.select().from(productsTable).where(eq(productsTable.farmerId, uid))
      const productIds = products.map(p => p.id)
      if (productIds.length) {
        try { await tx.delete(favoritesTable).where(inArray(favoritesTable.productId, productIds)) } catch {}
        try { await tx.delete(cartTable).where(inArray(cartTable.productId, productIds)) } catch {}
        try { await tx.delete(reviewsTable).where(inArray(reviewsTable.productId, productIds)) } catch {}
        try { await tx.delete(ordersTable).where(inArray(ordersTable.productId, productIds)) } catch {}
        try { await tx.delete(productsTable).where(inArray(productsTable.id, productIds)) } catch {}
      }

      // 3) Reviews, review comments
      try { await tx.delete(reviewCommentsTable).where(eq(reviewCommentsTable.authorUserId, uid)) } catch {}
      try { await tx.delete(reviewsTable).where(or(eq(reviewsTable.reviewerId, uid), eq(reviewsTable.reviewedId, uid))) } catch {}

      // 4) Favorites & Cart for this user
      try { await tx.delete(favoritesTable).where(eq(favoritesTable.buyerId, uid)) } catch {}
      try { await tx.delete(cartTable).where(eq(cartTable.userId, uid)) } catch {}

      // 5) Reports & appeals
      try { await tx.delete(userReportsTable).where(or(eq(userReportsTable.reportedUserId, uid), eq(userReportsTable.reporterId, uid), eq(userReportsTable.validatedByUserId, uid))) } catch {}
      try { await tx.delete(reportAppealsTable).where(or(eq(reportAppealsTable.userId, uid), eq(reportAppealsTable.resolverUserId, uid))) } catch {}

      // 6) Verification-related
      try { await tx.delete(verificationAppealsTable).where(or(eq(verificationAppealsTable.userId, uid), eq(verificationAppealsTable.resolverUserId, uid))) } catch {}
      try { await tx.delete(verificationSubmissionsTable).where(or(eq(verificationSubmissionsTable.userId, uid), eq(verificationSubmissionsTable.reviewerId, uid), eq(verificationSubmissionsTable.reviewerId2, uid))) } catch {}
      try { await tx.delete(userVerificationTable).where(eq(userVerificationTable.userId, uid)) } catch {}
      try { await tx.delete(verificationStatusHistoryTable).where(eq(verificationStatusHistoryTable.actorUserId, uid)) } catch {}

      // 7) Upload tokens, notifications, audit logs
      try { await tx.delete(uploadTokensTable).where(eq(uploadTokensTable.userId, uid)) } catch {}
      try { await tx.delete(userNotificationsTable).where(eq(userNotificationsTable.userId, uid)) } catch {}
      try { await tx.delete(auditLogsTable).where(eq(auditLogsTable.actorUserId, uid)) } catch {}

      // 8) Order status history rows referencing this user as actor
      try { await tx.delete(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.changedByUserId, uid)) } catch {}

      // 9) Finally delete the user row
      await tx.delete(usersTable).where(eq(usersTable.id, uid))
    })

    return res.json({ ok: true })
  } catch (e) {
    console.error('admin hard-delete user error', e)
    return res.status(500).json({ error: 'failed' })
  }
})