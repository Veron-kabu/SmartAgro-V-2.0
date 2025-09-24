import express from "express"
import cors from "cors"
import "dotenv/config"
import { db } from "./config/db.js"
import withClerk, { requireUser, ensureAuth, getAuth, clerkClient, verifyClerkWebhook } from "./middleware/auth.js"
import { SWITCHABLE_ROLES } from "./constants/roles.js"
import protectRoutes from "./middleware/protect.js"
import { requireRole } from "./middleware/role.js"
import { ENV, validateEnv } from "./config/env.js"
import cronJob from "./config/cron.js"
import { usersTable, productsTable, ordersTable, messagesTable, favoritesTable, marketDataTable, reviewsTable } from "./db/schema.js"
import { and, eq, gt, gte, lte, inArray } from "drizzle-orm"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import locationRouter from "./models/location.js"

try {
  validateEnv()
  console.log("✅ Environment variables validated successfully")
} catch (error) {
  console.error("❌ Environment validation failed:", error.message)
  process.exit(1)
}

const app = express()
const PORT = ENV.PORT

app.use(
  cors({
    origin: ENV.ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "svix-id", "svix-timestamp", "svix-signature"],
  }),
)

// JSON parser for all routes EXCEPT the webhook route (which needs raw body)
// and EXCEPT the profile route (we attach a larger limit only for that route below)
app.use((req, res, next) => {
  if (req.path === "/api/webhooks/clerk" || req.path === "/api/users/profile") return next()
  return express.json({ limit: "10mb", type: "application/json" })(req, res, next)
})

// Attach Clerk auth to every request BEFORE any route uses ensureAuth/getAuth
app.use(withClerk)

// Optional: signed URL for private avatar access
app.get("/api/uploads/avatar-signed-url", ensureAuth(), async (req, res) => {
  try {
    const { key } = req.query || {}
    if (!key || typeof key !== "string") return res.status(400).json({ error: "key is required" })
    const { AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = ENV
    const s3 = new S3Client({
      region: AWS_S3_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    })
    const cmd = new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key })
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
    res.json({ url })
  } catch (e) {
    console.error("signed-url error:", e)
    res.status(500).json({ error: "Failed to get signed url" })
  }
})

// Resolve avatar URL to a usable display URL (signed when private)
app.get("/api/uploads/resolve-avatar-url", ensureAuth(), async (req, res) => {
  try {
    const { url } = req.query || {}
    if (!url || typeof url !== "string") return res.status(400).json({ error: "url is required" })
    const { AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_PUBLIC_READ, AWS_CLOUDFRONT_DOMAIN } = ENV
    // If uploads not configured, or URL not our bucket/domain, just passthrough
    const isS3Like = (() => {
      try {
        const u = new URL(url)
        const host = u.host
        if (AWS_CLOUDFRONT_DOMAIN && host === AWS_CLOUDFRONT_DOMAIN) return true
        const s3Host = `${AWS_S3_BUCKET}.s3.${AWS_S3_REGION}.amazonaws.com`
        return !!AWS_S3_BUCKET && !!AWS_S3_REGION && host === s3Host
      } catch {
        return false
      }
    })()
    if (!isS3Like || AWS_S3_PUBLIC_READ) {
      return res.json({ url, ttlSeconds: null })
    }
    // Private S3: sign a GET for the key derived from path
    const u = new URL(url)
    let key = u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname
    const s3 = new S3Client({
      region: AWS_S3_REGION,
      credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
    })
    const cmd = new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key })
    const expiresIn = 60 * 5
    const signed = await getSignedUrl(s3, cmd, { expiresIn })
    return res.json({ url: signed, ttlSeconds: expiresIn })
  } catch (e) {
    console.error("resolve-avatar-url error:", e)
    res.status(500).json({ error: "Failed to resolve avatar url" })
  }
})
// Clerk middleware already registered above

if (ENV.NODE_ENV === "production") {
  cronJob.start()
  console.log("🕐 Cron job started for server keep-alive")
}

// Centralized route protection patterns
// Redirect-style protection for any browser routes under /protected
app.use(protectRoutes(["/protected(.*)"], { mode: "redirect" }))
// API protection: ensure 401 JSON on protected API namespaces
app.use(protectRoutes(["/api/admin(.*)", "/api/secure(.*)"], { mode: "api" }))

// Minimal mount for location APIs (keeps server.js lean)
app.use(locationRouter)

// ------------------ Webhook Handlers ------------------
app.post(
  "/api/webhooks/clerk",
  // Parse raw body for signature verification
  express.raw({ type: "application/json" }),
  verifyClerkWebhook,
  async (req, res) => {
    try {
      const evt = req.clerkEvent
      if (!evt) return res.status(400).json({ error: "Missing verified event" })
      const { type, data } = evt

      switch (type) {
        case "user.created":
          await handleUserCreated(data)
          break
        case "user.updated":
          await handleUserUpdated(data)
          break
        case "user.deleted":
          await handleUserDeleted(data)
          break
        default:
          console.log(`Unhandled webhook type: ${type}`)
      }

      res.status(200).json({ received: true })
    } catch (error) {
      console.error("Webhook error:", error)
      res.status(500).json({ error: "Webhook processing failed" })
    }
  },
)

// ------------------ User Management ------------------
// Presign upload for avatar to S3 (optional feature)
app.post("/api/uploads/avatar-presign", ensureAuth(), async (req, res) => {
  try {
    const { contentType = "image/jpeg", contentLength } = req.body || {}
    const { AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_PUBLIC_READ, UPLOAD_MAX_MB, AWS_CLOUDFRONT_DOMAIN } = ENV
    if (!AWS_S3_BUCKET || !AWS_S3_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return res.status(501).json({ error: "Uploads not configured" })
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(contentType)) {
      return res.status(400).json({ error: "Unsupported content type", allowed })
    }
    if (contentLength && Number(contentLength) > UPLOAD_MAX_MB * 1024 * 1024) {
      return res.status(413).json({ error: `File too large. Max ${UPLOAD_MAX_MB}MB` })
    }

    const s3 = new S3Client({
      region: AWS_S3_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    })
    const key = `avatars/${req.auth.userId}/${Date.now()}`
    const acl = AWS_S3_PUBLIC_READ ? "public-read" : undefined
    const cmd = new PutObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key, ContentType: contentType, ACL: acl })
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
    const originUrl = AWS_CLOUDFRONT_DOMAIN
      ? `https://${AWS_CLOUDFRONT_DOMAIN}/${key}`
      : `https://${AWS_S3_BUCKET}.s3.${AWS_S3_REGION}.amazonaws.com/${key}`
    res.json({ uploadUrl, publicUrl: originUrl, contentType, acl: acl || "private" })
  } catch (error) {
    console.error("Presign error:", error)
    res.status(500).json({ error: "Failed to presign upload" })
  }
})
app.post("/api/users", ensureAuth(), async (req, res) => {
  try {
    const existingUser = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))

    if (existingUser.length > 0) {
      return res.json(existingUser[0])
    }

    const { username, email, role, full_name, phone, location } = req.body || {}
    if (!username || !email) {
      return res.status(400).json({ error: "username and email are required" })
    }

    const allowed = ["buyer", "farmer"]
    const safeRole = allowed.includes(role) ? role : "buyer"

    // Fetch Clerk user to accurately set emailVerified at insertion time
    let emailVerified = false
    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId)
      const primaryEmailObj =
        clerkUser?.emailAddresses?.find((e) => e.id === clerkUser?.primaryEmailAddressId) ||
        clerkUser?.emailAddresses?.[0]
      emailVerified = (primaryEmailObj?.verification?.status === "verified") || false
    } catch (e) {
      // Non-fatal: fallback to false if Clerk fetch fails
      emailVerified = false
    }

    const inserted = await db
      .insert(usersTable)
      .values({
        clerkUserId: req.auth.userId,
        username,
        email,
        role: safeRole,
        fullName: full_name,
        phone,
        location,
        emailVerified,
      })
      .returning()

    // Best-effort sync Clerk unsafeMetadata.role so authorization matches DB
    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId)
      const current = (clerkUser && clerkUser.unsafeMetadata) || {}
      if (current.role !== safeRole) {
        await clerkClient.users.updateUser(req.auth.userId, {
          unsafeMetadata: { ...current, role: safeRole },
        })
      }
    } catch (metaErr) {
      console.warn("Failed to set Clerk metadata role on user creation:", metaErr)
    }

    res.json(inserted[0])
  } catch (error) {
    console.error("Error creating user:", error)
    res.status(500).json({ error: "Failed to create user" })
  }
})

app.get("/api/users/profile", ensureAuth(), async (req, res) => {
  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }
    res.json(user[0])
  } catch (error) {
    console.error("Error fetching user:", error)
    res.status(500).json({ error: "Failed to fetch user" })
  }
})

// Update current user's profile fields
// Apply a larger JSON limit specifically for profile updates to handle base64 images
app.patch(
  "/api/users/profile",
  express.json({ limit: "25mb", type: "application/json" }),
  ensureAuth(),
  async (req, res) => {
  try {
    const me = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (me.length === 0) return res.status(404).json({ error: "User not found" })

    const { username, email, full_name, phone, location, profile_image_url } = req.body || {}

    // Uniqueness checks for username and email when provided
    if (typeof username === "string" && username.trim()) {
      const taken = await db.select().from(usersTable).where(eq(usersTable.username, username.trim()))
      if (taken.length > 0 && taken[0].id !== me[0].id) {
        return res.status(409).json({ error: "conflict", field: "username", message: "Username already taken" })
      }
    }
    if (typeof email === "string" && email.trim()) {
      const emailNorm = email.trim()
      const taken = await db.select().from(usersTable).where(eq(usersTable.email, emailNorm))
      if (taken.length > 0 && taken[0].id !== me[0].id) {
        return res.status(409).json({ error: "conflict", field: "email", message: "Email already in use" })
      }
    }

    const updates = {}
    if (typeof username !== "undefined") updates.username = username?.trim() || null
    if (typeof email !== "undefined") updates.email = email?.trim() || null
    if (typeof full_name !== "undefined") updates.fullName = full_name || null
    if (typeof phone !== "undefined") updates.phone = phone || null
    if (typeof location !== "undefined") updates.location = location || null
    if (typeof profile_image_url !== "undefined") {
      // Allowlist: only permit URLs pointing to our S3 bucket or CloudFront domain (if configured)
      const { AWS_S3_BUCKET, AWS_S3_REGION, AWS_CLOUDFRONT_DOMAIN } = ENV
      const allowlistHosts = []
      if (AWS_S3_BUCKET && AWS_S3_REGION) allowlistHosts.push(`${AWS_S3_BUCKET}.s3.${AWS_S3_REGION}.amazonaws.com`)
      if (AWS_CLOUDFRONT_DOMAIN) allowlistHosts.push(AWS_CLOUDFRONT_DOMAIN)
      const val = profile_image_url || null
      if (val === null) {
        updates.profileImageUrl = null
      } else if (allowlistHosts.length === 0) {
        // If not configured, accept as-is (development convenience)
        updates.profileImageUrl = val
      } else {
        try {
          const u = new URL(val)
          if (!allowlistHosts.includes(u.host)) {
            return res.status(400).json({ error: "Invalid image URL host" })
          }
          updates.profileImageUrl = val
        } catch {
          return res.status(400).json({ error: "Invalid image URL" })
        }
      }
    }
    updates.updatedAt = new Date()

    const updated = await db.update(usersTable).set(updates).where(eq(usersTable.clerkUserId, req.auth.userId)).returning()
    return res.json(updated[0])
  } catch (error) {
    console.error("Error updating user profile:", error)
    res.status(500).json({ error: "Failed to update profile" })
  }
}
)

// Update user's role (allow switching only between buyer and farmer)
app.patch("/api/users/role", ensureAuth(), async (req, res) => {
  try {
    const { role } = req.body || {}
    if (!SWITCHABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role. Allowed: buyer, farmer" })
    }

  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (existing.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    await db
      .update(usersTable)
      .set({ role, updatedAt: new Date() })
      .where(eq(usersTable.clerkUserId, req.auth.userId))

    // Sync Clerk unsafeMetadata.role for consistency (best-effort)
    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId)
      const current = (clerkUser && clerkUser.unsafeMetadata) || {}
      await clerkClient.users.updateUser(req.auth.userId, {
        unsafeMetadata: { ...current, role },
      })
    } catch (metaErr) {
      console.warn("Failed to update Clerk metadata for role:", metaErr)
    }

  const updated = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    return res.json(updated[0])
  } catch (error) {
    console.error("Error updating user role:", error)
    res.status(500).json({ error: "Failed to update role" })
  }
})

// ------------------ Product APIs ------------------
app.get("/api/products", async (req, res) => {
  try {
    const { category, search, min_price, max_price, is_organic } = req.query
    let query = db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.status, "active"), gt(productsTable.quantityAvailable, 0)))

    if (category) query = query.where(eq(productsTable.category, category))
    if (min_price) query = query.where(gte(productsTable.price, min_price))
    if (max_price) query = query.where(lte(productsTable.price, max_price))
    if (is_organic === "true") query = query.where(eq(productsTable.isOrganic, true))

    let products = await query
    products = products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json(products)
  } catch (error) {
    console.error("Error fetching products:", error)
    res.status(500).json({ error: "Failed to fetch products" })
  }
})

// Get product details by ID
app.get("/api/products/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id)
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" })
    }
  const product = await db.select().from(productsTable).where(eq(productsTable.id, productId))
    if (product.length === 0) {
      return res.status(404).json({ error: "Product not found" })
    }
    res.json(product[0])
  } catch (error) {
    console.error("Error fetching product details:", error)
    res.status(500).json({ error: "Failed to fetch product details" })
  }
})

app.post("/api/products", ensureAuth(), requireRole(["farmer"]), async (req, res) => {
  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))

    const { title, category, price, unit, quantity_available, location } = req.body

    if (!title || !category || !price || !unit || !quantity_available || !location) {
      return res.status(400).json({ error: "Missing required product fields" })
    }

    // ...existing code for other fields...
    const { description, minimum_order, harvest_date, expiry_date, images, is_organic } = req.body

    const inserted = await db
      .insert(productsTable)
      .values({
        farmerId: user[0].id,
        title,
        description,
        category,
        price,
        unit,
        quantityAvailable: quantity_available,
        minimumOrder: minimum_order,
        harvestDate: harvest_date,
        expiryDate: expiry_date,
        location,
        images,
        isOrganic: is_organic,
      })
      .returning()

    res.json(inserted[0])
  } catch (error) {
    console.error("Error creating product:", error)
    res.status(500).json({ error: "Failed to create product" })
  }
})

// ------------------ Order APIs ------------------
// Get orders for the authenticated buyer
app.get("/api/orders", ensureAuth(), requireRole(["buyer"]), async (req, res) => {
  try {
    // Only support buyer=me for now
    const { buyer, limit: limitStr, offset: offsetStr } = req.query
    if (buyer !== "me") {
      return res.status(400).json({ error: "Unsupported query. Use buyer=me" })
    }

    const me = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.clerkUserId, req.auth.userId), eq(usersTable.role, "buyer")))

    if (me.length === 0) {
      return res.status(403).json({ error: "Access denied" })
    }

  let limit = Number(limitStr)
  let offset = Number(offsetStr)
  if (!Number.isFinite(limit) || limit <= 0 || limit > 100) limit = 25
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  // drizzle's select doesn't have limit/offset chaining in this simple example, so fetch all and slice
  // In production you can use .limit/.offset when using a query builder supporting it for postgres
  let rows = await db.select().from(ordersTable).where(eq(ordersTable.buyerId, me[0].id))
  rows = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const pageRows = rows.slice(offset, offset + limit)

    // Always return a paginated object; even when empty, return { items: [], total, limit, offset }

    const productIds = Array.from(new Set(pageRows.map((r) => r.productId)))
    const farmerIds = Array.from(new Set(pageRows.map((r) => r.farmerId)))
    const orderIds = pageRows.map((r) => r.id)

    const [products, farmers, myReviews] = await Promise.all([
      db.select().from(productsTable).where(inArray(productsTable.id, productIds)),
      db.select().from(usersTable).where(inArray(usersTable.id, farmerIds)),
      orderIds.length > 0
        ? db
            .select()
            .from(reviewsTable)
            .where(and(eq(reviewsTable.reviewerId, me[0].id), inArray(reviewsTable.orderId, orderIds)))
        : Promise.resolve([]),
    ])

    const productMap = new Map(products.map((p) => [p.id, p]))
    const farmerMap = new Map(farmers.map((f) => [f.id, f]))
    const reviewMap = new Map(myReviews.map((r) => [r.orderId, r]))

    const result = pageRows.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        hasReview: reviewMap.has(o.id),
        reviewRating: reviewMap.get(o.id)?.rating ?? null,
        product: (() => {
          const p = productMap.get(o.productId)
          return p
            ? { id: p.id, title: p.title, price: p.price, unit: p.unit }
            : { id: o.productId, title: null, price: null, unit: null }
        })(),
        farmer: (() => {
          const f = farmerMap.get(o.farmerId)
          return f ? { id: f.id, fullName: f.fullName || f.username } : { id: o.farmerId, fullName: null }
        })(),
      }))

    res.json({ items: result, total: rows.length, limit, offset })
  } catch (error) {
    console.error("Error fetching buyer orders:", error)
    res.status(500).json({ error: "Failed to fetch orders" })
  }
})
app.post("/api/orders", ensureAuth(), requireRole(["buyer"]), async (req, res) => {
  try {
    const buyer = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))

    const { product_id, quantity, delivery_address } = req.body
    if (!product_id || !quantity || !delivery_address) {
      return res.status(400).json({ error: "Missing required order fields" })
    }
    const { notes } = req.body
    const product = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, product_id), eq(productsTable.status, "active")))

    if (product.length === 0) {
      return res.status(404).json({ error: "Product not found or not available" })
    }
    if (product[0].quantityAvailable < quantity) {
      return res.status(400).json({ error: "Insufficient quantity available" })
    }

    const total_amount = Number(product[0].price) * quantity
    const inserted = await db
      .insert(ordersTable)
      .values({
        buyerId: buyer[0].id,
        farmerId: product[0].farmerId,
        productId: product_id,
        quantity,
        unitPrice: product[0].price,
        totalAmount: total_amount,
        deliveryAddress: delivery_address,
        notes,
      })
      .returning()

    res.json(inserted[0])
  } catch (error) {
    console.error("Error creating order:", error)
    res.status(500).json({ error: "Failed to create order" })
  }
})

// Update order status
app.patch("/api/orders/:id/status", ensureAuth(), requireRole(["farmer", "admin"]), async (req, res) => {
  try {
    const orderId = Number(req.params.id)
    const { status } = req.body
    const validStatuses = ["pending", "accepted", "rejected", "shipped", "delivered", "cancelled"]
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" })
    }
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" })
    }
  const updated = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, orderId)).returning()
    if (updated.length === 0) {
      return res.status(404).json({ error: "Order not found" })
    }
    res.json(updated[0])
  } catch (error) {
    console.error("Error updating order status:", error)
    res.status(500).json({ error: "Failed to update order status" })
  }
})

// ------------------ Reviews API ------------------
// Create a review for an order (buyer only)
app.post("/api/reviews", ensureAuth(), requireRole(["buyer"]), async (req, res) => {
  try {
    const { order_id, rating, comment } = req.body || {}
    const orderId = Number(order_id)
    const score = Number(rating)
    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: "Valid order_id is required" })
    }
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5" })
    }

    const me = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.clerkUserId, req.auth.userId), eq(usersTable.role, "buyer")))
    if (me.length === 0) return res.status(403).json({ error: "Access denied" })

    const ord = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId))
    if (ord.length === 0) return res.status(404).json({ error: "Order not found" })
    if (ord[0].buyerId !== me[0].id) return res.status(403).json({ error: "Cannot review someone else's order" })
    // Optional: enforce delivered
    const okStatuses = ["delivered", "completed"]
    if (!okStatuses.includes((ord[0].status || "").toLowerCase())) {
      return res.status(400).json({ error: "Order not delivered; cannot review yet" })
    }

    const inserted = await db
      .insert(reviewsTable)
      .values({
        orderId,
        reviewerId: me[0].id,
        reviewedId: ord[0].farmerId,
        rating: score,
        comment: comment || null,
      })
      .returning()

    res.json(inserted[0])
  } catch (error) {
    console.error("Error creating review:", error)
    res.status(500).json({ error: "Failed to create review" })
  }
})

// Get reviews for current buyer or by order
app.get("/api/reviews", ensureAuth(), async (req, res) => {
  try {
    const { buyer, order_id } = req.query || {}
    let reviewerId = null
    if (buyer === "me") {
      const me = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
      if (me.length === 0) return res.status(403).json({ error: "Access denied" })
      reviewerId = me[0].id
    }

    const whereClauses = []
    if (reviewerId) whereClauses.push(eq(reviewsTable.reviewerId, reviewerId))
    if (order_id) {
      const oid = Number(order_id)
      if (!Number.isFinite(oid)) return res.status(400).json({ error: "Invalid order_id" })
      whereClauses.push(eq(reviewsTable.orderId, oid))
    }

    let reviews = []
    if (whereClauses.length > 0) {
      // Build AND filter
      const predicate = whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses)
      reviews = await db.select().from(reviewsTable).where(predicate)
    } else {
      reviews = await db.select().from(reviewsTable)
    }

    if (reviews.length === 0) return res.json([])

    const farmerIds = Array.from(new Set(reviews.map((r) => r.reviewedId)))
    const farmers = await db.select().from(usersTable).where(inArray(usersTable.id, farmerIds))
    const farmerMap = new Map(farmers.map((f) => [f.id, f]))

    const result = reviews
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => ({
        id: r.id,
        orderId: r.orderId,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        farmer: (() => {
          const f = farmerMap.get(r.reviewedId)
          return f ? { id: f.id, fullName: f.fullName || f.username } : { id: r.reviewedId, fullName: null }
        })(),
      }))

    res.json(result)
  } catch (error) {
    console.error("Error fetching reviews:", error)
    res.status(500).json({ error: "Failed to fetch reviews" })
  }
})
// ------------------ Favorites API ------------------
app.post("/api/favorites", ensureAuth(), requireRole(["buyer"]), async (req, res) => {
  try {
    const user = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.clerkUserId, req.auth.userId), eq(usersTable.role, "buyer")))

    if (user.length === 0) {
      return res.status(403).json({ error: "Only buyers can add favorites" })
    }

    const { product_id } = req.body
    if (!product_id || isNaN(Number(product_id))) {
      return res.status(400).json({ error: "Valid product ID is required" })
    }

    // Check if product exists
  const product = await db.select().from(productsTable).where(eq(productsTable.id, product_id))
    if (product.length === 0) {
      return res.status(404).json({ error: "Product not found" })
    }

    // Check if already favorited
    const existing = await db
      .select()
      .from(favoritesTable)
      .where(and(eq(favoritesTable.buyerId, user[0].id), eq(favoritesTable.productId, product_id)))
    if (existing.length > 0) {
      return res.status(409).json({ error: "Product already in favorites" })
    }

    const inserted = await db.insert(favoritesTable).values({ buyerId: user[0].id, productId: product_id }).returning()

    res.json(inserted[0])
  } catch (error) {
    console.error("Error adding favorite:", error)
    res.status(500).json({ error: "Failed to add favorite" })
  }
})

// Get favorites for the authenticated buyer
app.get("/api/favorites", ensureAuth(), requireRole(["buyer"]), async (req, res) => {
  try {
    const { buyer } = req.query
    if (buyer !== "me") return res.status(400).json({ error: "Unsupported query. Use buyer=me" })

    const me = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.clerkUserId, req.auth.userId), eq(usersTable.role, "buyer")))
    if (me.length === 0) return res.status(403).json({ error: "Access denied" })

    const favs = await db.select().from(favoritesTable).where(eq(favoritesTable.buyerId, me[0].id))
    if (favs.length === 0) return res.json([])

    const productIds = Array.from(new Set(favs.map((f) => f.productId)))
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds))
    const farmerIds = Array.from(new Set(products.map((p) => p.farmerId)))
    const farmers = await db.select().from(usersTable).where(inArray(usersTable.id, farmerIds))

    const productMap = new Map(products.map((p) => [p.id, p]))
    const farmerMap = new Map(farmers.map((u) => [u.id, u]))

    const result = favs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((f) => {
        const p = productMap.get(f.productId)
        const farmer = p ? farmerMap.get(p.farmerId) : null
        return {
          id: f.id,
          createdAt: f.createdAt,
          product: p
            ? { id: p.id, title: p.title, price: p.price, unit: p.unit, images: p.images, location: p.location }
            : { id: f.productId },
          farmer: farmer ? { id: farmer.id, fullName: farmer.fullName || farmer.username } : null,
        }
      })

    res.json(result)
  } catch (error) {
    console.error("Error fetching favorites:", error)
    res.status(500).json({ error: "Failed to fetch favorites" })
  }
})

// ------------------ Messaging API ------------------
app.post("/api/messages", ensureAuth(), requireRole(["buyer", "farmer", "admin"]), async (req, res) => {
  try {
    const sender = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))

    if (sender.length === 0) {
      return res.status(403).json({ error: "Sender not found" })
    }

    const { receiver_id, order_id, message } = req.body
    if (
      !receiver_id ||
      isNaN(Number(receiver_id)) ||
      !message ||
      typeof message !== "string" ||
      message.trim() === ""
    ) {
      return res.status(400).json({ error: "Valid receiver ID and non-empty message are required" })
    }

    // Check if receiver exists
  const receiver = await db.select().from(usersTable).where(eq(usersTable.id, receiver_id))
    if (receiver.length === 0) {
      return res.status(404).json({ error: "Receiver not found" })
    }

    // If order_id is provided, check if order exists
    if (order_id) {
  const order = await db.select().from(ordersTable).where(eq(ordersTable.id, order_id))
      if (order.length === 0) {
        return res.status(404).json({ error: "Order not found" })
      }
    }

    const inserted = await db
      .insert(messagesTable)
      .values({
        senderId: sender[0].id,
        receiverId: receiver_id,
        orderId: order_id || null,
        message,
      })
      .returning()

    res.json(inserted[0])
  } catch (error) {
    console.error("Error sending message:", error)
    res.status(500).json({ error: "Failed to send message" })
  }
})

// ------------------ Dashboard API ------------------
app.get("/api/dashboard/farmer", ensureAuth(), requireRole(["farmer"]), async (req, res) => {
  try {
    const farmer = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.clerkUserId, req.auth.userId), eq(usersTable.role, "farmer")))

    if (farmer.length === 0) {
      return res.status(403).json({ error: "Access denied" })
    }

  const products = await db.select().from(productsTable).where(eq(productsTable.farmerId, farmer[0].id))
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.farmerId, farmer[0].id))

    const totalRevenue = orders
      .filter((order) => order.status === "delivered")
      .reduce((sum, order) => sum + Number.parseFloat(order.totalAmount), 0)

    res.json({
      totalProducts: products.length,
      activeOrders: orders.filter((o) => ["pending", "accepted"].includes(o.status)).length,
      totalRevenue: totalRevenue.toFixed(2),
      recentProducts: products.slice(0, 5),
      recentOrders: orders.slice(0, 5),
    })
  } catch (error) {
    console.error("Error fetching farmer dashboard:", error)
    res.status(500).json({ error: "Failed to fetch dashboard data" })
  }
})

// ------------------ Market Data API ------------------
app.get("/api/market-data", async (req, res) => {
  try {
    const { category, location, season } = req.query
    let query = db.select().from(marketDataTable)
    if (category) query = query.where(eq(marketDataTable.category, category))
    if (location) query = query.where(eq(marketDataTable.location, location))
    if (season) query = query.where(eq(marketDataTable.season, season))
    const data = await query
    res.json(data)
  } catch (error) {
    console.error("Error fetching market data:", error)
    res.status(500).json({ error: "Failed to fetch market data" })
  }
})

// ------------------ Health Check Route ------------------
app.get("/", (req, res) => {
  res.json({
    message: "Farmer-Buyer System API",
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV,
  })
})

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// ------------------ Error Handling ------------------
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: "Something went wrong!" })
})

// ------------------ Server ------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT: ${PORT}`)
  console.log(`🌍 Environment: ${ENV.NODE_ENV}`)
  console.log(`🔗 CORS enabled for origins: ${ENV.ALLOWED_ORIGINS.join(", ")}`)
})

// ------------------ Sample Protected Route ------------------
app.get("/protected", requireUser, async (req, res) => {
  try {
    const { userId } = getAuth(req)
    const user = await clerkClient.users.getUser(userId)
    res.json({ ok: true, user })
  } catch (e) {
    console.error("/protected error", e)
    res.status(500).json({ error: "Failed to load protected resource" })
  }
})

// ------------------ Clerk Event Handlers ------------------
async function handleUserCreated(userData) {
  // Clerk user payload shape: https://clerk.com/docs/reference/webhooks
  const {
    id,
    email_addresses = [],
    username,
    first_name,
    last_name,
    image_url,
    primary_email_address_id,
    unsafe_metadata = {},
  } = userData || {}

  if (!id || email_addresses.length === 0) return

  const primaryEmailObj =
    email_addresses.find((e) => e.id === primary_email_address_id) || email_addresses[0]
  const primaryEmail = primaryEmailObj?.email_address

  // Derive fields matching our schema
  const role = unsafe_metadata.role || "buyer" // default role
  const fullName = unsafe_metadata.full_name || [first_name, last_name].filter(Boolean).join(" ") || null
  const phone = unsafe_metadata.phone || null
  const location = unsafe_metadata.location || null
  const emailVerified = primaryEmailObj?.verification?.status === "verified" || false

  // username is required in schema; derive a fallback if missing
  const derivedUsername = username || (primaryEmail ? primaryEmail.split("@")[0] : `user_${id.slice(-6)}`)

  // Upsert-like behavior: try insert, if conflict update basic fields
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, id))

    if (existing.length > 0) {
      await db
        .update(usersTable)
        .set({
          username: derivedUsername,
          email: primaryEmail,
          role,
          fullName,
          phone,
          location,
          profileImageUrl: image_url || null,
          emailVerified,
          status: "active",
          updatedAt: new Date(),
        })
  .where(eq(usersTable.clerkUserId, id))
    } else {
      await db.insert(usersTable).values({
        clerkUserId: id,
        username: derivedUsername,
        email: primaryEmail,
        role,
        fullName,
        phone,
        location,
        profileImageUrl: image_url || null,
        emailVerified,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  } catch (e) {
    console.error("handleUserCreated error:", e)
  }
}

async function handleUserUpdated(userData) {
  const { id } = userData || {}
  if (!id) return
  // Reuse creation logic to upsert fields
  return handleUserCreated(userData)
}

async function handleUserDeleted(userData) {
  const { id } = userData || {}
  if (!id) return
  try {
    await db
      .update(usersTable)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(usersTable.clerkUserId, id))
  } catch (e) {
    console.error("handleUserDeleted error:", e)
  }
}
