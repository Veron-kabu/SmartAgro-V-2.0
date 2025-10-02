import { Router } from 'express'
import express from 'express'
import { db } from '../config/db.js'
import { usersTable } from '../db/schema.js'
import { ensureAuth, clerkClient } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { ENV } from '../config/env.js'
import { eq } from 'drizzle-orm'

const router = Router()

// Ensure JSON parsing (larger limit) for profile routes since server.js skips global parser for this path
router.use('/users/profile', express.json({ limit: '25mb', type: 'application/json' }))

// Create user
router.post('/users', ensureAuth(), async (req, res) => {
  try {
    const existingUser = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (existingUser.length > 0) return res.json(existingUser[0])
    const { username, email, role, full_name, phone, location } = req.body || {}
    if (!username || !email) return res.status(400).json({ error: 'username and email are required' })
    const allowed = ['buyer','farmer']
    const safeRole = allowed.includes(role) ? role : 'buyer'
    let emailVerified = false
    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId)
      const primaryEmailObj = clerkUser?.emailAddresses?.find(e => e.id === clerkUser?.primaryEmailAddressId) || clerkUser?.emailAddresses?.[0]
      emailVerified = (primaryEmailObj?.verification?.status === 'verified') || false
    } catch { emailVerified = false }
    const inserted = await db.insert(usersTable).values({
      clerkUserId: req.auth.userId,
      username,
      email,
      role: safeRole,
      fullName: full_name,
      phone,
      location,
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

// Get profile
router.get('/users/profile', ensureAuth(), async (req, res) => {
  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (user.length === 0) return res.status(404).json({ error: 'User not found' })
    res.json(user[0])
  } catch (e) {
    console.error('Error fetching user profile:', e)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})



// Update profile (large body)
router.patch('/users/profile', ensureAuth(), async (req,res) => {
  try {
    const me = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.auth.userId))
    if (me.length === 0) return res.status(404).json({ error: 'User not found' })
  const { username, email, full_name, phone, location, profile_image_url, profile_image_blurhash } = req.body || {}
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
    if (typeof location !== 'undefined') updates.location = location || null
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
          updates.profileImageUrl = val
        } catch { return res.status(400).json({ error: 'Invalid image URL' }) }
      }
    }
    if (typeof profile_image_blurhash !== 'undefined') updates.profileImageBlurhash = profile_image_blurhash || null
  // Banner fields removed (feature deferred)
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

export default router