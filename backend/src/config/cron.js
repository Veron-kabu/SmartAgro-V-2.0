import cron from "cron"
import https from "https"
import http from "http"
import { ENV } from "./env.js"
import { db } from "../config/db.js"
import { usersTable, productsTable, uploadTokensTable, verificationSubmissionsTable, userVerificationTable } from "../db/schema.js"
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { computeBlurhashFromUrl } from "../utils/blurhash.js"
import { sendEmail, renderDigestEmail } from "../utils/email.js"

// Keep-alive ping (every 14 minutes)
const job = new cron.CronJob("*/14 * * * *", () => {
  const apiUrl = ENV.API_URL

  if (!apiUrl) {
    console.warn("API_URL not configured, skipping keep-alive ping")
    return
  }

  const client = apiUrl.startsWith("https://") ? https : http

  client
    .get(apiUrl + "/health", (res) => {
      if (res.statusCode === 200) {
        console.log("✅ Keep-alive ping sent successfully")
      } else {
        console.log("⚠️ Keep-alive ping failed with status:", res.statusCode)
      }
    })
    .on("error", (e) => {
      console.error("❌ Error while sending keep-alive ping:", e.message)
    })
})

// Lightweight periodic blurhash backfill (runs every hour at minute 7)
// Intentionally low limit each run to spread CPU usage.
const blurhashBackfillJob = new cron.CronJob("7 * * * *", async () => {
  if (ENV.DISABLE_AUTO_BACKFILL === 'true') return
  try {
    const limit = 15
    const users = await db.select().from(usersTable)
    const products = await db.select().from(productsTable)
    let updated = 0
    async function encode(url) { try { const { hash } = await computeBlurhashFromUrl(url); return hash } catch { return null } }
    // Users first: profile + banner
    for (const u of users) {
      if (updated >= limit) break
      if ((!u.profileImageUrl || u.profileImageBlurhash) && (!u.bannerImageUrl || u.bannerImageBlurhash)) continue
      const patch = {}
      if (u.profileImageUrl && !u.profileImageBlurhash) { const h = await encode(u.profileImageUrl); if (h) patch.profileImageBlurhash = h }
      if (u.bannerImageUrl && !u.bannerImageBlurhash) { const h = await encode(u.bannerImageUrl); if (h) patch.bannerImageBlurhash = h }
      if (Object.keys(patch).length) { patch.updatedAt = new Date(); await db.update(usersTable).set(patch).where(usersTable.id.eq(u.id)); updated++ }
    }
    // Products next
    for (const p of products) {
      if (updated >= limit) break
      if (!Array.isArray(p.images) || p.images.length === 0 || (Array.isArray(p.imageBlurhashes) && p.imageBlurhashes.length > 0)) continue
      const hashes = []
      for (const url of p.images.slice(0,6)) { const h = await encode(url); if (h) hashes.push(h) }
      if (hashes.length) { await db.update(productsTable).set({ imageBlurhashes: hashes, updatedAt: new Date() }).where(productsTable.id.eq(p.id)); updated++ }
    }
    if (updated > 0) console.log(`🔄 Blurhash cron backfill updated ${updated} records`)
  } catch (e) {
    console.warn('blurhash cron backfill failed', e.message)
  }
})

// Orphan product image cleanup (runs daily at 02:30). Strategy:
// 1. List objects under products/ prefix (single page up to 1000)
// 2. For each object older than GRACE_DAYS and not referenced in any product.images, delete it.
// NOTE: This is a lightweight best-effort cleaner; for very large buckets a paginated / batched
// approach or manifest tracking would be preferable.
const orphanProductImageCleanupJob = new cron.CronJob('30 2 * * *', async () => {
  try {
    if (ENV.DISABLE_ORPHAN_CLEANUP === 'true') return
    const { AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = ENV
    if (!AWS_S3_BUCKET || !AWS_S3_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) return
    const s3 = new S3Client({ region: AWS_S3_REGION, credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY } })
    const graceDays = Number(process.env.ORPHAN_IMAGE_GRACE_DAYS || 3)
    const cutoff = Date.now() - graceDays * 24 * 60 * 60 * 1000
    const list = await s3.send(new ListObjectsV2Command({ Bucket: AWS_S3_BUCKET, Prefix: 'products/' }))
    if (!list.Contents || list.Contents.length === 0) return
    // Build a set of all referenced product image paths (without domain) for quick lookup
    const prods = await db.select().from(productsTable)
    const referenced = new Set()
    for (const p of prods) {
      if (Array.isArray(p.images)) {
        for (const url of p.images) {
          try {
            const u = new URL(url)
            const path = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
            referenced.add(path)
          } catch {}
        }
      }
    }
    let deleted = 0
    for (const obj of list.Contents) {
      if (!obj || !obj.Key) continue
      if (!obj.Key.startsWith('products/')) continue
      if (referenced.has(obj.Key)) continue
      if (!obj.LastModified || obj.LastModified.getTime() > cutoff) continue // retain within grace window
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: obj.Key }))
        deleted++
      } catch (e) { /* non-fatal */ }
    }
    if (deleted > 0) console.log(`🧽 Orphan product image cleanup removed ${deleted} object(s) older than ${graceDays}d`)
  } catch (e) {
    console.warn('orphan image cleanup failed', e.message)
  }
})

export { job as default, blurhashBackfillJob, orphanProductImageCleanupJob }

// Nightly cleanup of expired upload tokens at 03:00
const cleanupExpiredCodesTokensJob = new cron.CronJob('0 3 * * *', async () => {
  try {
    const now = new Date()
    // Delete expired upload tokens
    try {
      const rows = await db.select().from(uploadTokensTable)
      const expiredIds = rows.filter(r => r.expiresAt && new Date(r.expiresAt) < now).map(r => r.id)
      for (const id of expiredIds) { try { await db.delete(uploadTokensTable).where(uploadTokensTable.id.eq(id)) } catch {} }
    } catch {}
    console.log('🧹 Nightly cleanup completed for upload tokens')
  } catch (e) {
    console.warn('nightly cleanup failed', e.message)
  }
})

export { cleanupExpiredCodesTokensJob }

// Daily flagged digest email to admins (if SMTP configured)
const dailyDigestJob = new cron.CronJob(ENV.DIGEST_CRON || '0 8 * * *', async () => {
  try {
    if (!ENV.ADMIN_EMAILS || ENV.ADMIN_EMAILS.length === 0) return
    const all = await db.select().from(verificationSubmissionsTable)
    const flagged = all.filter(r => r.status === 'flagged')
    if (flagged.length === 0) return
    const { subject, text, html } = renderDigestEmail({ items: flagged.slice(0, 200) })
    for (const email of ENV.ADMIN_EMAILS) {
      await sendEmail({ to: email, subject, text, html })
    }
    console.log(`📧 Sent daily digest to ${ENV.ADMIN_EMAILS.length} admin(s) — ${flagged.length} flagged items`)
  } catch (e) {
    console.warn('daily digest failed', e.message)
  }
})

export { dailyDigestJob }

// Automated farmer verification job (runs hourly at minute 5)
// Criteria (all must pass):
//  - role == 'farmer' and status == 'active'
//  - emailVerified == true
//  - strikesCount <= 1
//  - At least 1 active product with a location (lat/lng) set
//  - Has profileImageUrl
//  - Not already farmVerified
// Marks users.farmVerified = true and ensures user_verification.status = 'verified'.
// Best-effort: skips users failing any check; does NOT downgrade existing verified users.
const autoFarmerVerificationJob = new cron.CronJob('5 * * * *', async () => {
  try {
    if (ENV.DISABLE_AUTO_VERIFY === 'true') return
    const farmers = await db.select().from(usersTable)
    let updatedCount = 0
    for (const u of farmers) {
      try {
        if (u.role !== 'farmer') continue
        if (u.status !== 'active') continue
        if (u.farmVerified) continue
        if (!u.emailVerified) continue
        if (Number(u.strikesCount || 0) > 1) continue
        if (!u.profileImageUrl) continue
        const latOk = u.latitude != null && u.longitude != null
        // At least one active product with quantity > 0 and location
        const prods = await db.select().from(productsTable).where(productsTable.farmerId.eq(u.id))
        const hasValidProduct = prods.some(p => p.status === 'active' && Number(p.quantityAvailable || 0) > 0 && p.latitude != null && p.longitude != null)
        if (!hasValidProduct) continue
        // Ready to verify
        await db.update(usersTable).set({ farmVerified: true, updatedAt: new Date() }).where(usersTable.id.eq(u.id))
        // Upsert into user_verification table
        try {
          const existing = await db.select().from(userVerificationTable).where(userVerificationTable.userId.eq(u.id))
          if (existing.length === 0) {
            await db.insert(userVerificationTable).values({ userId: u.id, status: 'verified' })
          } else if (existing[0].status !== 'verified') {
            await db.update(userVerificationTable).set({ status: 'verified', updatedAt: new Date() }).where(userVerificationTable.userId.eq(u.id))
          }
        } catch {}
        updatedCount++
      } catch (inner) {
        // Non-fatal; continue with others
      }
    }
    if (updatedCount > 0) console.log(`✅ Auto verification job marked ${updatedCount} farmer(s) verified`)
  } catch (e) {
    console.warn('autoFarmerVerificationJob failed', e.message)
  }
})

export { autoFarmerVerificationJob }

// CRON JOB EXPLANATION:
// Cron jobs are scheduled tasks that run periodically at fixed intervals
// we want to send 1 GET request for every 14 minutes so that our api never gets inactive on Render.com

// How to define a "Schedule"?
// You define a schedule using a cron expression, which consists of 5 fields representing:

// MINUTE, HOUR, DAY OF THE MONTH, MONTH, DAY OF THE WEEK

// EXAMPLES && EXPLANATION:
// 14 * * * * - Every 14 minutes
// 0 0 * * 0 - At midnight on every Sunday
// 30 3 15 * * - At 3:30 AM, on the 15th of every month
// 0 0 1 1 * - At midnight, on January 1st
// 0 * * * * - Every hour
