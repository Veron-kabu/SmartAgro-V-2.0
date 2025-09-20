// db/schema.js
import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =======================
// USERS
// =======================
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 20 }).notNull(), // buyer, farmer, admin
  fullName: varchar("full_name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  location: jsonb("location"),
  profileImageUrl: text("profile_image_url"),
  emailVerified: boolean("email_verified").default(false),
  status: varchar("status", { length: 20 }).default("active"), // active, inactive, suspended
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =======================
// PRODUCTS (Farmer Listings)
// =======================
export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  farmerId: integer("farmer_id").references(() => usersTable.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  quantityAvailable: integer("quantity_available").default(0).notNull(),
  minimumOrder: integer("minimum_order").default(1),
  harvestDate: timestamp("harvest_date"),
  expiryDate: timestamp("expiry_date"),
  location: jsonb("location").notNull(),
  images: jsonb("images").default([]),
  isOrganic: boolean("is_organic").default(false),
  status: varchar("status", { length: 20 }).default("active"), // active, sold, expired, inactive
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =======================
// ORDERS
// =======================
export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").references(() => usersTable.id).notNull(),
  farmerId: integer("farmer_id").references(() => usersTable.id).notNull(),
  productId: integer("product_id").references(() => productsTable.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, accepted, rejected, shipped, delivered, cancelled
  deliveryAddress: jsonb("delivery_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =======================
// MESSAGES
// =======================
export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => usersTable.id).notNull(),
  receiverId: integer("receiver_id").references(() => usersTable.id).notNull(),
  orderId: integer("order_id").references(() => ordersTable.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// =======================
// FAVORITES
// =======================
export const favoritesTable = pgTable("favorites", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").references(() => usersTable.id).notNull(),
  productId: integer("product_id").references(() => productsTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// =======================
// REVIEWS
// =======================
export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => ordersTable.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => usersTable.id).notNull(),
  reviewedId: integer("reviewed_id").references(() => usersTable.id).notNull(),
  rating: integer("rating"), // 1 to 5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =======================
// MARKET DATA
// =======================
export const marketDataTable = pgTable("market_data", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  averagePrice: decimal("average_price", { precision: 10, scale: 2 }),
  demandLevel: varchar("demand_level", { length: 20 }), // low, medium, high
  season: varchar("season", { length: 20 }),
  location: varchar("location", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =======================
// RELATIONS
// =======================
export const usersRelations = relations(usersTable, ({ many }) => ({
  products: many(productsTable),
  ordersAsBuyer: many(ordersTable, { relationName: "buyer" }),
  ordersAsFarmer: many(ordersTable, { relationName: "farmer" }),
  messagesSent: many(messagesTable, { relationName: "sender" }),
  messagesReceived: many(messagesTable, { relationName: "receiver" }),
  favorites: many(favoritesTable),
  reviewsWritten: many(reviewsTable, { relationName: "reviewer" }),
  reviewsReceived: many(reviewsTable, { relationName: "reviewed" }),
}));

export const productsRelations = relations(productsTable, ({ many, one }) => ({
  farmer: one(usersTable, {
    fields: [productsTable.farmerId],
    references: [usersTable.id],
  }),
  orders: many(ordersTable),
  favorites: many(favoritesTable),
}));

export const ordersRelations = relations(ordersTable, ({ one }) => ({
  buyer: one(usersTable, {
    fields: [ordersTable.buyerId],
    references: [usersTable.id],
  }),
  farmer: one(usersTable, {
    fields: [ordersTable.farmerId],
    references: [usersTable.id],
  }),
  product: one(productsTable, {
    fields: [ordersTable.productId],
    references: [productsTable.id],
  }),
}));

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  sender: one(usersTable, {
    fields: [messagesTable.senderId],
    references: [usersTable.id],
  }),
  receiver: one(usersTable, {
    fields: [messagesTable.receiverId],
    references: [usersTable.id],
  }),
  order: one(ordersTable, {
    fields: [messagesTable.orderId],
    references: [ordersTable.id],
  }),
}));

export const favoritesRelations = relations(favoritesTable, ({ one }) => ({
  buyer: one(usersTable, {
    fields: [favoritesTable.buyerId],
    references: [usersTable.id],
  }),
  product: one(productsTable, {
    fields: [favoritesTable.productId],
    references: [productsTable.id],
  }),
}));

export const reviewsRelations = relations(reviewsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [reviewsTable.orderId],
    references: [ordersTable.id],
  }),
  reviewer: one(usersTable, {
    fields: [reviewsTable.reviewerId],
    references: [usersTable.id],
  }),
  reviewed: one(usersTable, {
    fields: [reviewsTable.reviewedId],
    references: [usersTable.id],
  }),
}));
