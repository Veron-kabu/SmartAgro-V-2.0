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
import { usersTable, productsTable, ordersTable, messagesTable, favoritesTable, marketDataTable } from "./db/schema.js"
import { and, eq, gt, gte, lte } from "drizzle-orm"

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
app.use((req, res, next) => {
  if (req.path === "/api/webhooks/clerk") return next()
  return express.json()(req, res, next)
})
// Attach Clerk auth to every request
app.use(withClerk)

if (ENV.NODE_ENV === "production") {
  cronJob.start()
  console.log("🕐 Cron job started for server keep-alive")
}

// Centralized route protection patterns
// Redirect-style protection for any browser routes under /protected
app.use(protectRoutes(["/protected(.*)"], { mode: "redirect" }))
// API protection: ensure 401 JSON on protected API namespaces
app.use(protectRoutes(["/api/admin(.*)", "/api/secure(.*)"], { mode: "api" }))

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

  const primaryEmail =
    email_addresses.find((e) => e.id === primary_email_address_id)?.email_address || email_addresses[0]?.email_address

  // Derive fields matching our schema
  const role = unsafe_metadata.role || "buyer" // default role
  const fullName = unsafe_metadata.full_name || [first_name, last_name].filter(Boolean).join(" ") || null
  const phone = unsafe_metadata.phone || null
  const location = unsafe_metadata.location || null
  const emailVerified = email_addresses[0]?.verification?.status === "verified" || false

  // username is required in schema; derive a fallback if missing
  const derivedUsername = username || (primaryEmail ? primaryEmail.split("@")[0] : `user_${id.slice(-6)}`)

  // Upsert-like behavior: try insert, if conflict update basic fields
  try {
    const existing = await db.select().from(usersTable).where(usersTable.clerkUserId.eq(id))

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
        .where(usersTable.clerkUserId.eq(id))
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
    await db.update(usersTable).set({ status: "inactive", updatedAt: new Date() }).where(usersTable.clerkUserId.eq(id))
  } catch (e) {
    console.error("handleUserDeleted error:", e)
  }
}
