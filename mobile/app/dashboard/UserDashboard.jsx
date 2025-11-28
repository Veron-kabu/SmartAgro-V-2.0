import { View, Text, TouchableOpacity, TextInput, Alert, Modal, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native'
// import { Image as ExpoImage } from 'expo-image'
import BlurhashImage from '../../components/BlurhashImage'
import { LinearGradient } from 'expo-linear-gradient'
import { useUser } from '@clerk/clerk-expo'
import { useLogout } from '../../hooks/useLogout'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useProfile } from '../../context/profile'
import { getJSON, postJSON, patchJSON } from '../../context/api'
import { useDashboardMedia } from '../../hooks/useDashboardMedia'
import { router, useFocusEffect } from 'expo-router'
import CountBadge from '../../components/CountBadge'
import { useChat } from '../../context/chat'
import { subscribeAppEvents } from '../../context/favorites'
import VerificationBanner from '../../components/VerificationBanner'
import { useToast } from '../../context/toast'
import { profileStyles as styles } from '../../assets/styles/(tabs)/profile.styles'
import { COLORS } from '../../constants/colors'
import { userDashboardStyles as modalStyles } from '../../assets/styles/userDashboard.styles'

// Floating FabActions removed for farmer: actions integrated into sections

// Shared dashboard for Buyer and Farmer with identical UI; location stays hidden
export default function UserDashboard({ expectedRole = 'buyer', fallbackName = 'User' }) {
  const { user } = useUser()
  const { profile, refresh, applyLocalUpdate } = useProfile()
  const [loading, setLoading] = useState(true)
  const [recentProducts, setRecentProducts] = useState([])
  // Removed inline/bottom-sheet listings usage; dedicated screen navigation instead
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editEmail, setEditEmail] = useState(profile?.email || '')
  const [editUsername, setEditUsername] = useState(profile?.username || '')
  const [editPhone, setEditPhone] = useState(profile?.phone || '')
  // Build initial address from normalized fields or legacy blob
  const getInitialAddress = () => {
    if (!profile) return ''
    if (profile.placeName) return profile.placeName
    if (typeof profile.location === 'string') return profile.location
    if (profile.location?.name) return profile.location.name
    if (profile.latitude && profile.longitude) return `${Number(profile.latitude).toFixed(4)}, ${Number(profile.longitude).toFixed(4)}`
    return ''
  }
  const [editAddress, setEditAddress] = useState(getInitialAddress())
  const [editFullName, setEditFullName] = useState(profile?.fullName || '')
  const [pickingImage, setPickingImage] = useState(false)
  // media & stats hooks
  const { avatarUrl, bannerUrl, bannerResolving, setBannerUrl } = useDashboardMedia(profile)
  // const { stats } = useDashboardStats(!loading, 60000)
  // Unread messages for notifications badge on profile
  const { chatRooms } = useChat()
  const unreadTotal = Array.isArray(chatRooms)
    ? chatRooms.reduce((sum, r) => sum + (Number(r?.unreadCount) || 0), 0)
    : 0
  // Verification notifications count (rejected / flagged etc)
  const [verifNotifCount, setVerifNotifCount] = useState(0)
  // Notifications modal state
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifItems, setNotifItems] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const refreshVerifCount = useCallback(async (mountedRef) => {
    try {
      const resp = await getJSON('/api/verification/my-notifications')
      if (mountedRef.current === false) return
      const cnt = Array.isArray(resp?.items) ? resp.items.length : 0
      if (mountedRef.current !== false) setVerifNotifCount(cnt)
    } catch {
      if (mountedRef.current !== false) setVerifNotifCount(0)
    }
  }, [])


  const loadNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      const resp = await getJSON('/api/verification/my-notifications')
      const items = Array.isArray(resp?.items) ? resp.items : []
      setNotifItems(items)
    } catch {
      setNotifItems([])
    } finally {
      setNotifLoading(false)
    }
  }, [])

  // Persist read notifications in AsyncStorage
  const markRead = useCallback(async (id) => {
    try { await postJSON(`/api/verification/notifications/${id}/read`, {}) } catch {}
    // Reduce badge count but keep item visible in modal
    setNotifItems(prev => prev.map(i => i.id === id ? { ...i, readAt: i.readAt || new Date().toISOString() } : i))
    setVerifNotifCount(c => Math.max(0, c - 1))
  }, [])

  // Open notification deep link
  const openNotification = useCallback((item) => {
    const type = item?.type
    const data = item?.data || {}
    const id = item?.id
    // Explicit routes in payload take precedence
    const route = typeof data?.route === 'string' ? data.route : null
    if (route) {
      try { router.push(route) } catch {}
      if (id) markRead(id)
      setNotifOpen(false)
      return
    }
    if ((type === 'review_created' || type === 'review_commented') && data.reviewId) {
      try { router.push({ pathname: '/reviews/[id]', params: { id: String(data.reviewId) } }) } catch {}
      if (id) markRead(id)
      setNotifOpen(false)
      return
    }
    if ((type === 'moderation' || type === 'account_suspended')) {
      try { router.push({ pathname: '/appeals', params: data?.reportId ? { reportId: String(data.reportId) } : {} }) } catch {}
      if (id) markRead(id)
      setNotifOpen(false)
      return
    }
    if (type === 'verification_status' && data?.submissionId) {
      try { router.push('/verification') } catch {}
      if (id) markRead(id)
      setNotifOpen(false)
      return
    }
    // Generic fallbacks: orders, products, chat
    if (data?.orderId) {
      try { router.push({ pathname: '/orders/[id]', params: { id: String(data.orderId) } }) } catch {}
      if (id) markRead(id)
      setNotifOpen(false)
      return
    }
    if (data?.productId) {
      try { router.push({ pathname: '/products/[id]', params: { id: String(data.productId) } }) } catch {}
      if (id) markRead(id)
      setNotifOpen(false)
      return
    }
    if (data?.chatId) {
      try { router.push('/chat') } catch {}
      if (id) markRead(id)
      setNotifOpen(false)
      return
    }
    // Nothing matched; just mark read
    if (id) markRead(id)
    setNotifOpen(false)
  }, [markRead])

  const deleteNotif = useCallback(async (id) => {
    // If it was unread, also decrement count
    setNotifItems(prev => {
      const target = prev.find(i => i.id === id)
      if (target && !target.readAt) setVerifNotifCount(c => Math.max(0, c - 1))
      return prev.filter(i => i.id !== id)
    })
    try { await postJSON(`/api/verification/notifications/${id}/delete`, {}) } catch {}
  }, [])

  useEffect(() => {
    const mountedRef = { current: true }
    refreshVerifCount(mountedRef)
    return () => { mountedRef.current = false }
  }, [refreshVerifCount])

  useFocusEffect(
    useCallback(() => {
      const mountedRef = { current: true }
      refreshVerifCount(mountedRef)
      return () => { mountedRef.current = false }
    }, [refreshVerifCount])
  )
  const totalBadge = (unreadTotal || 0) + (verifNotifCount || 0)
  // Dashboard listing thumbnail (random from recent products) — only setter used elsewhere
  const [, setListingThumbRaw] = useState(null)
  // Password change state
  const [showPwd, setShowPwd] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  // Password visibility toggles
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [greeting, setGreeting] = useState('')
  const toast = useToast()
  // Collapsible sections state removed
  // const [openOrders, setOpenOrders] = useState(true) // replaced by single Orders button
  // Collapsible Funds section removed; single Funds button links to Funds hub
  const { signingOut, logout: confirmLogout } = useLogout()

  // Banner image error handling guards to prevent endless retry loops
  const bannerRetryRef = useRef(0)
  const bannerResolveBusyRef = useRef(false)
  const bannerLogOnceRef = useRef(false)

  // Simple currency formatter (later can use Intl if locale / polyfill present)
  // formatCurrency removed with old Funds metrics section

  // Load persisted collapse state (removed - no longer needed)
  // useEffect(() => {
  //   (async () => {
  //     try {
  //       const keys = Object.values(collapseKeys.current)
  //       const entries = await AsyncStorage.multiGet(keys)
  //       const map = Object.fromEntries(entries)
  //       if (map[collapseKeys.current.listings]) setOpenListings(map[collapseKeys.current.listings] === '1')
  //     } catch (e) {
  //       console.log('collapse restore failed', e.message)
  //     }
  //   })()
  // }, [])

  const patchProfile = useCallback(async (payload) => {
    const updated = await patchJSON('/api/users/profile', payload)
    // Apply local update to avoid a full-screen reload
    applyLocalUpdate?.(updated)
    return updated
  }, [applyLocalUpdate])

  const onPickImage = useCallback(async () => {
    if (pickingImage) return
    try {
      setPickingImage(true)
      const picked = await pickImageFromLibrary({ base64: false })
      if (!picked) return
      const { uri, mime } = picked
      // Optional EXIF stripping could be added with expo-image-manipulator if installed
      const fileResp = await fetch(uri)
      const blob = await fileResp.blob()
      const presign = await postJSON('/api/uploads/avatar-presign', { contentType: mime || 'image/jpeg', contentLength: blob.size })
      const putResp = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': presign.contentType }, body: blob })
      if (!putResp.ok) {
        throw new Error(`S3 upload failed (${putResp.status})`)
      }
      await patchProfile({ profile_image_url: presign.publicUrl })
      // Fire-and-forget blurhash generation
      ;(async () => {
        try {
          const resp = await fetch('/api/utils/blurhash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: presign.publicUrl }) })
          if (resp.ok) {
            const data = await resp.json()
            if (data.blurhash) await patchProfile({ profile_image_blurhash: data.blurhash })
          }
        } catch { /* ignore */ }
      })()
      toast.show('Profile image updated', { type: 'success' })
    } catch (e) {
      toast.show(e?.message || 'Failed to update image', { type: 'error' })
    } finally {
      setPickingImage(false)
    }
  }, [pickingImage, patchProfile, toast])

  const onPickBanner = useCallback(async () => {
    if (pickingImage) return
    try {
      setPickingImage(true)
      const picked = await pickImageFromLibrary({ base64: false })
      if (!picked) return
      const { uri, mime } = picked
      const fileResp = await fetch(uri)
      const blob = await fileResp.blob()
      // Mirror avatar flow exactly: always use avatar-presign for consistent behavior
      const presign = await postJSON('/api/uploads/avatar-presign', { contentType: mime || 'image/jpeg', contentLength: blob.size })
      const putResp = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': presign.contentType }, body: blob })
      if (!putResp.ok) {
        throw new Error(`S3 upload failed (${putResp.status})`)
      }
      await patchProfile({ banner_image_url: presign.publicUrl })
  // Reset error/retry guards after a successful update
  bannerRetryRef.current = 0
  bannerLogOnceRef.current = false
      // Optional: compute blurhash on the fly
      ;(async () => {
        try {
          const resp = await fetch('/api/utils/blurhash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: presign.publicUrl }) })
          if (resp.ok) {
            const data = await resp.json()
            if (data.blurhash) await patchProfile({ banner_image_blurhash: data.blurhash })
          }
        } catch {}
      })()
      toast.show('Banner updated', { type: 'success' })
    } catch (e) {
      toast.show(e?.message || 'Failed to update banner', { type: 'error' })
    } finally {
      setPickingImage(false)
    }
  }, [pickingImage, patchProfile, toast])

  const onRemoveBanner = useCallback(async () => {
    try {
      await patchProfile({ banner_image_url: null, banner_image_blurhash: null })
      // Optimistic UI update
      if (typeof setBannerUrl === 'function') setBannerUrl(null)
      // Reset guards when removing so next set starts clean
      bannerRetryRef.current = 0
      bannerLogOnceRef.current = false
      toast.show('Banner removed', { type: 'success' })
    } catch (e) {
      toast.show(e?.message || 'Failed to remove banner', { type: 'error' })
    }
  }, [patchProfile, setBannerUrl, toast])

  // Quick actions for media via small icon buttons
  // Unified media actions (single camera button will open these)
  const openMediaActions = useCallback(() => {
    Alert.alert(
      'Media',
      'Choose an action',
      [
        { text: 'Change profile photo', onPress: () => onPickImage() },
        { text: 'Remove profile photo', style: 'destructive', onPress: () => onRemoveAvatar() },
        { text: 'Change banner', onPress: () => onPickBanner() },
        { text: 'Remove banner', style: 'destructive', onPress: () => onRemoveBanner() },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }, [onPickImage, onRemoveAvatar, onPickBanner, onRemoveBanner])

  const onRemoveAvatar = useCallback(async () => {
    try {
      await patchProfile({ profile_image_url: null, profile_image_blurhash: null })
      toast.show('Profile image removed', { type: 'success' })
    } catch (e) {
      toast.show(e?.message || 'Failed to remove profile image', { type: 'error' })
    }
  }, [patchProfile, toast])

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        if (!profile) await refresh()
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [profile, refresh])

  // Compute greeting based on current time and refresh it periodically
  useEffect(() => {
    const compute = () => {
      const h = new Date().getHours()
      const g = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening'
      const first = (profile?.fullName?.split(' ')?.[0]) || user?.firstName || profile?.username || fallbackName
      setGreeting(`${g}, ${first}`)
    }
    compute()
    const id = setInterval(compute, 60 * 1000)
    return () => clearInterval(id)
  }, [profile?.fullName, profile?.username, user?.firstName, fallbackName])

  // Fetch recent products and role-specific dashboard (farmer)
  const fetchData = useCallback(async () => {
    try {
      // Fetch a larger page and then filter to this farmer's products so the thumbnail comes from your listings
      const productsRes = await getJSON(`/api/products?limit=50`)
      const list = Array.isArray(productsRes)
        ? productsRes
        : (Array.isArray(productsRes?.items) ? productsRes.items : [])
      const mine = profile?.id ? list.filter(p => p.farmerId === profile.id) : []
      setRecentProducts(mine.slice(0, 5))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }, [profile?.id])

  // loadFarmerListings no longer needed (list handled in separate screen)

  useEffect(() => {
    if (!loading) fetchData()
  }, [loading, fetchData])

  // Real-time: when a product is created by this farmer, bump Available count and recent products
  useEffect(() => {
    const unsub = subscribeAppEvents(evt => {
      if (evt.type !== 'product:created' && evt.type !== 'product:updated') return
      const { product } = evt.payload || {}
      const ownerId = product?.farmerId
      if (!profile?.id) return
      if (ownerId && ownerId !== profile.id) return
      // Update recent products list (local only)
      if (product) {
        setRecentProducts(prev => {
          const exists = prev.some(p => p.id === product.id)
          const next = exists ? prev.map(p => p.id === product.id ? { ...p, ...product } : p) : [product, ...prev].slice(0, 5)
          return next
        })
        // Optionally refresh the listing thumbnail
        if (Array.isArray(product.images) && product.images.length > 0) {
          setListingThumbRaw(t => t || product.images[0])
        }
      } else {
        // Fallback: refetch dashboard to be safe
        fetchData()
      }
    })
    return () => { unsub && unsub() }
  }, [profile?.id, fetchData])

  // Helper: pick a random listing image (avoid repeating if possible)
  const pickRandomListingThumb = useCallback(() => {
    if (!Array.isArray(recentProducts) || recentProducts.length === 0) {
      setListingThumbRaw(null)
      return
    }
    const withImages = recentProducts.filter(p => Array.isArray(p.images) && p.images.length > 0)
    if (withImages.length === 0) {
      setListingThumbRaw(null)
      return
    }
    // Use functional updater to read the latest value and avoid creating
    // a dependency on `listingThumbRaw` which would make this callback
    // change every time the thumb updates (causing an effect loop).
    setListingThumbRaw(prev => {
      let next = prev
      for (let attempt = 0; attempt < 5; attempt++) {
        const idx = Math.floor(Math.random() * withImages.length)
        const candidate = withImages[idx].images[0]
        if (candidate && candidate !== prev) {
          next = candidate
          break
        }
        if (attempt === 4) next = candidate
      }
      return next || null
    })
  }, [recentProducts])

  // When recentProducts change, (re)seed the random listing image
  useEffect(() => {
    pickRandomListingThumb()
  }, [pickRandomListingThumb])

  // (Removed inline avatar/banner/stats effects in favor of hooks)

  // Prepare edit fields only when opening the modal, so typing isn't overwritten
  const openEditModal = useCallback(() => {
    setEditEmail(profile?.email || '')
    setEditUsername(profile?.username || '')
    setEditPhone(profile?.phone || '')
    setEditFullName(profile?.fullName || profile?.username || '')
    // Build address from normalized fields
    let addr = ''
    if (profile?.placeName) addr = profile.placeName
    else if (typeof profile?.location === 'string') addr = profile.location
    else if (profile?.location?.name) addr = profile.location.name
    else if (profile?.latitude && profile?.longitude) addr = `${Number(profile.latitude).toFixed(4)}, ${Number(profile.longitude).toFixed(4)}`
    setEditAddress(addr)
    // Slight delay before opening modal to reduce flicker when rapid back navigation occurs
    requestAnimationFrame(() => setEditOpen(true))
  }, [profile])

  // When the modal becomes visible, prefill from the latest profile as a safety net
  useEffect(() => {
    if (!editOpen) return
    setEditEmail(profile?.email || '')
    setEditUsername(profile?.username || '')
    setEditPhone(profile?.phone || '')
    setEditFullName(profile?.fullName || profile?.username || '')
    // Build address from normalized fields
    let addr = ''
    if (profile?.placeName) addr = profile.placeName
    else if (typeof profile?.location === 'string') addr = profile.location
    else if (profile?.location?.name) addr = profile.location.name
    else if (profile?.latitude && profile?.longitude) addr = `${Number(profile.latitude).toFixed(4)}, ${Number(profile.longitude).toFixed(4)}`
    setEditAddress(addr)
  }, [editOpen, profile])

  // Avatar refresh handled by useDashboardMedia hook

  const role = profile?.role || expectedRole

  // Prefetch admin system pages data to make system pages open instantly on first click.
  useEffect(() => {
    if (String(role || '').toLowerCase() !== 'admin') return
    // Fire-and-forget prefetch; store into global cache variables used by system pages
    ;(async () => {
      try {
        const prodP = getJSON('/api/analytics/marketplace').catch(() => null)
        const txP = getJSON('/api/analytics/transactions').catch(() => null)
        const verP = getJSON('/api/admin/verifications?status=pending').catch(() => null)
        const repP = getJSON('/api/admin/reports').catch(() => null)
        const appealsP = getJSON('/api/admin/verification-appeals?status=open').catch(() => null)
        const [prod, tx, ver, rep, appeals] = await Promise.all([prodP, txP, verP, repP, appealsP])
        try { if (prod) global.__cached_products_data__ = prod } catch {}
        try { if (tx) global.__cached_transactions__ = tx } catch {}
        try { if (Array.isArray(ver?.items)) global.__cached_verifications__ = ver.items } catch {}
        try { if (Array.isArray(rep?.items)) global.__cached_reports__ = rep.items } catch {}
        try { if (Array.isArray(appeals?.items)) global.__cached_appeals__ = appeals.items } catch {}
      } catch (_e) {
        // ignore prefetch errors
      }
    })()
  }, [role])

  // Orders navigation removed in new UI layout (add back if needed)

  // ---------- Edit form derived state & actions ----------
  const emailValid = !editEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)
  const usernameValid = (editUsername || '').trim().length >= 3
  const fullNameValid = (editFullName || '').trim().length >= 2
  const phoneValid = !editPhone || (editPhone || '').trim().length >= 7
  const passwordValid = !showPwd || ((newPwd || '').length >= 8 && newPwd === confirmPwd)
  const addressValid = true
  const isValid = emailValid && usernameValid && fullNameValid && phoneValid && addressValid && passwordValid

  const hasChanges = (
    (editFullName || '') !== (profile?.fullName || '') ||
    (editUsername || '') !== (profile?.username || '') ||
    (editEmail || '') !== (profile?.email || '') ||
    (editPhone || '') !== (profile?.phone || '') ||
    ((editAddress || '') !== (typeof profile?.location === 'string' ? profile.location : ''))
  )

  const hasPasswordChange = showPwd && passwordValid
  const canSubmit = isValid && (hasChanges || hasPasswordChange)

  const changePassword = useCallback(async () => {
    if (!showPwd) return
    if (!passwordValid) throw new Error('Password invalid')
    if (!user) throw new Error('Not authenticated')
    try {
      if (currentPwd) {
        await user.updatePassword({ currentPassword: currentPwd, newPassword: newPwd })
      } else {
        try {
          // @ts-ignore - RN env may not have TS types for this
          if (typeof user.createPassword === 'function') {
            await user.createPassword({ password: newPwd })
          } else {
            await user.updatePassword({ newPassword: newPwd })
          }
        } catch (_err) {
          await user.updatePassword({ newPassword: newPwd })
        }
      }
    } finally {
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setShowPwd(false)
    }
  }, [showPwd, passwordValid, user, currentPwd, newPwd])

  const handleSave = useCallback(async () => {
    if (!canSubmit || saving) return
    try {
      setSaving(true)
      if (hasPasswordChange) {
        await changePassword()
        toast.show('Password updated', { type: 'success' })
      }
      if (hasChanges) {
        await patchProfile({ full_name: editFullName, username: editUsername, email: editEmail, phone: editPhone, location: (editAddress || null) })
      }
      setEditOpen(false)
      if (hasChanges && !hasPasswordChange) {
        toast.show('Profile updated', { type: 'success' })
      }
    } catch (e) {
      const field = e?.body ? (() => { try { const j = JSON.parse(e.body); return j.field } catch { return null } })() : null
      const msg = e?.message || 'Failed to save'
      // Keep Alert for explicit conflict clarity; also surface toast
      Alert.alert(field ? `Conflict: ${field}` : 'Error', field ? `${field} already in use` : msg)
      toast.show(field ? `${field} already in use` : msg, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }, [canSubmit, saving, hasPasswordChange, hasChanges, changePassword, editFullName, editUsername, editEmail, editPhone, editAddress, patchProfile, toast])

  // Listen for profile location picked from the map and update the address field optimistically
  useEffect(() => {
    if (!editOpen) return
    const { on, off } = require('../../utils/eventBus')
    const handler = (payload) => {
      if (payload?.address) setEditAddress(payload.address)
    }
    on('location:profile-updated', handler)
    return () => off('location:profile-updated', handler)
  }, [editOpen])

  // logout logic moved to shared hook useLogout

//  if (loading) {
//    return (
//      <View style={styles.center}>
//        <Text>Loading {expectedRole} dashboard…</Text>
//      </View>
//    )
//  }

  // Allow 'admin' to view any expectedRole dashboard variant without denial.
  // If you later implement impersonation logic, surface a small banner.
  const allowedRoles = new Set([expectedRole, 'admin'])
  const isAllowed = allowedRoles.has(role)
  if (!isAllowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.sectionTitle}>Access denied</Text>
  <Text style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>Your role &quot;{role}&quot; cannot view this page.</Text>
      </View>
    )
  }

  // Legacy sections removed after UI redesign

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroWrapper}>
          <View>
            {bannerUrl ? (
              <BlurhashImage
                key={bannerUrl || 'banner-placeholder'}
                uri={bannerUrl}
                blurhash={profile?.bannerImageBlurhash}
                style={styles.coverImage}
                onError={async (event) => {
                  try {
                    if (!bannerLogOnceRef.current) {
                      console.log('Banner image load error', event)
                      bannerLogOnceRef.current = true
                    }
                    if (bannerResolveBusyRef.current) return
                    // Stop after a few attempts, show placeholder
                    if (bannerRetryRef.current >= 3) { setBannerUrl(null); return }
                    bannerResolveBusyRef.current = true
                    const raw = profile?.bannerImageUrl || profile?.banner_image_url
                    if (!raw) return
                    const q = encodeURIComponent(raw)
                    // First try generic resolver
                    let r = await getJSON(`/api/uploads/resolve-avatar-url?force=1&url=${q}`)
                    if (r?.url) { setBannerUrl(r.url); return }
                    // Derive key and try direct signed-url endpoint as a fallback
                    try {
                      const u = new URL(raw)
                      const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
                      const s = await getJSON(`/api/uploads/avatar-signed-url?key=${encodeURIComponent(key)}`)
                      if (s?.url) setBannerUrl(s.url)
                    } catch {}
                  } catch (_e) {
                    // Silent: if resolve fails, keep placeholder gradient
                  } finally {
                    bannerResolveBusyRef.current = false
                    bannerRetryRef.current += 1
                  }
                }}
              />
            ) : (
              <LinearGradient colors={[COLORS.background, COLORS.border, COLORS.primary]} style={[styles.coverImage, styles.bannerPlaceholder]} start={{x:0,y:0}} end={{x:1,y:1}}>
                {bannerResolving || pickingImage ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
              </LinearGradient>
            )}
            <View style={styles.bannerOverlay}>
                  {/* Notifications overlay removed — use Notifications tile in Services grid */}
            </View>
            {/* Banner remove button hidden while feature deferred */}
          </View>
          <View style={styles.avatarWrapper}>
            <View activeOpacity={1} style={{ alignItems: 'center' }}>
              <BlurhashImage uri={avatarUrl || profile?.profileImageUrl || 'https://via.placeholder.com/96'} blurhash={profile?.profileImageBlurhash} style={styles.avatarLarge} />
            </View>
          </View>

          {/* Camera action overlapping banner & avatar: single entry for change/remove profile or banner */}
          <TouchableOpacity
            accessibilityLabel="Change profile or banner photo"
            onPress={openMediaActions}
            activeOpacity={0.85}
            style={{ position: 'absolute', right: 18, bottom: -12, zIndex: 20, backgroundColor: '#fff', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: COLORS.border }}
          >
            <Ionicons name="camera" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.profileInfo}>
          {!!greeting && <Text style={styles.greeting}>{greeting}</Text>}
        </View>

        {/* Services Grid (matches requested image style) */}
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f3f4f6' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 12 }}>My Services</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {/* Settings tile (opens existing Edit Profile modal) */}
            <TouchableOpacity onPress={openEditModal} style={{ width: '30%', alignItems: 'center', marginBottom: 12 }} activeOpacity={0.8}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="settings-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Settings</Text>
            </TouchableOpacity>

            {/* Messages / Chat tile (grid version) */}
            <TouchableOpacity onPress={() => { try { router.push('/chat') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12 }} activeOpacity={0.8}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chatbubbles-outline" size={24} color={COLORS.primary} />
                {unreadTotal > 0 && (
                  <CountBadge count={unreadTotal} max={99} size={14} style={{ position: 'absolute', top: -6, right: -6 }} />
                )}
              </View>
              <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Messages</Text>
            </TouchableOpacity>

            {/* Notifications tile (grid) */}
            <TouchableOpacity onPress={() => { setNotifOpen(true); loadNotifications() }} style={{ width: '30%', alignItems: 'center', marginBottom: 12 }} activeOpacity={0.8}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
                {totalBadge > 0 && (
                  <CountBadge count={totalBadge} max={99} size={14} style={{ position: 'absolute', top: -6, right: -6 }} />
                )}
              </View>
              <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Notifications</Text>
            </TouchableOpacity>

            {/* My Reviews removed per request */}

            {/* My Listings (farmers only) */}
            {String(profile?.role || '').toLowerCase() === 'farmer' && (
              <TouchableOpacity onPress={() => { try { router.push('/products/my-listings') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12 }} activeOpacity={0.8}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="layers-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>My Listings</Text>
              </TouchableOpacity>
            )}

            {/* Orders (non-admins) */}
            {String(profile?.role || '').toLowerCase() !== 'admin' && (
              <TouchableOpacity onPress={() => { try { router.push('/orders') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12 }} activeOpacity={0.8}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Orders</Text>
              </TouchableOpacity>
            )}

            {/* Earnings (farmers only) */}
            {String(profile?.role || '').toLowerCase() === 'farmer' && (
              <TouchableOpacity onPress={() => { try { router.push('/dashboard/earnings') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12 }} activeOpacity={0.8}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="wallet-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Earnings</Text>
              </TouchableOpacity>
            )}

            {/* System tile removed from Services grid; moved into its own grid below */}
          </View>
        </View>
        {/* Admin-only: System grid placed below Services */}
        {String(profile?.role || '').toLowerCase() === 'admin' && (
          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f3f4f6' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 12 }}>System</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              <TouchableOpacity onPress={() => { try { router.push('/dashboard/system/users') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12, marginRight: '5%' }} activeOpacity={0.8}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="people-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Users</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { try { router.push('/dashboard/system/products-transactions') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12, marginRight: '5%' }} activeOpacity={0.8}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="stats-chart-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Products</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { try { router.push('/dashboard/system/verification-reviews') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12 }} activeOpacity={0.8}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Verifications</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { try { router.push('/dashboard/system/reports') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12, marginRight: '5%' }} activeOpacity={0.8}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="flag-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { try { router.push('/dashboard/system/appeals') } catch {} }} style={{ width: '30%', alignItems: 'center', marginBottom: 12 }} activeOpacity={0.8}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="help-circle-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' }}>Appeals</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
          {/* Removed separate location button. Location picker is accessible inside Edit Profile next to Address. */}

        {/* Suspended account banner */}
        {String(profile?.status || '').toLowerCase() === 'suspended' && (
          <View style={{ marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text style={{ color: '#B91C1C', fontWeight: '700' }}>Your account is suspended</Text>
            <Text style={{ color: '#7F1D1D', marginTop: 4, fontSize: 12 }}>Ordering, posting listings, reviews and replies are disabled until your account is reactivated.</Text>
            <TouchableOpacity onPress={() => router.push('/appeals')} activeOpacity={0.85} style={{ alignSelf: 'flex-start', marginTop: 10, backgroundColor: '#111827', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Appeal suspension</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Verification CTA (hidden for admin) */}
        {role !== 'admin' && (
          <VerificationBanner role={role} containerStyle={{ marginHorizontal: 16, borderRadius: 8, marginTop: 8 }} />
        )}

  {/* Sections moved into Services grid: My Listings, Orders, Earnings (UI cleaned) */}

        {/* Switch Role section removed */}
        {role !== 'admin' && (
          <View style={styles.logoutContainer}>
            <TouchableOpacity
              onPress={confirmLogout}
              disabled={signingOut}
              style={[styles.logoutButton, signingOut && styles.logoutButtonDisabled]}
              activeOpacity={0.85}
            >
              {signingOut ? (
                <View style={styles.logoutRow}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.logoutText}>Logging out…</Text>
                </View>
              ) : (
                <Text style={styles.logoutText}>Log Out</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      {/* Notifications Modal */}
      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', maxHeight: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: '800' }}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotifOpen(false)} accessibilityLabel="Close notifications">
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {notifLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator />
                </View>
              ) : notifItems.length === 0 ? (
                <Text style={{ paddingVertical: 16, color: '#6b7280' }}>No notifications</Text>
              ) : (
                notifItems.map(item => (
                  <View key={item.id} style={{ marginBottom: 16, backgroundColor: '#fff', borderRadius: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 6 }}> {item.title || 'Notification'} </Text>
                    {!!item.body && <Text style={{ color: '#374151', marginBottom: 8 }}>{item.body}</Text>}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => openNotification(item)} activeOpacity={0.85} style={{ alignSelf: 'flex-start', backgroundColor: '#3b82f6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Open</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => markRead(item.id)} disabled={!!item.readAt} activeOpacity={0.85} style={{ alignSelf: 'flex-start', backgroundColor: item.readAt ? '#9ca3af' : '#16a34a', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{item.readAt ? 'Read' : 'Mark read'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteNotif(item.id)} activeOpacity={0.85} style={{ alignSelf: 'flex-start', backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* FabActions removed: actions now integrated into respective sections for farmer */}

      {/* Edit Profile Modal (full-screen, scrollable, keyboard-aware) */}
  <Modal visible={editOpen} animationType="none" presentationStyle="fullScreen" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={modalStyles.editContainer}>
            <View style={modalStyles.modalHeader}>
        {/**      <TouchableOpacity onPress={() => setEditOpen(false)}>
                <Text style={modalStyles.headerAction}>Cancel</Text>
              </TouchableOpacity>  */}
              <Text style={modalStyles.headerTitle}>Edit Profile</Text>
              <View style={{ width: 56 }} />
            </View>
            <ScrollView contentContainerStyle={modalStyles.editContent} keyboardShouldPersistTaps="handled">
              <Text style={modalStyles.inputLabel}>Full name</Text>
              <TextInput
                value={editFullName}
                onChangeText={setEditFullName}
                style={[modalStyles.input, !fullNameValid && modalStyles.inputError]}
                placeholder="e.g. Jane Doe"
                autoFocus
                returnKeyType="next"
              />
              {!fullNameValid && <Text style={modalStyles.errorText}>Please enter at least 2 characters</Text>}

              <Text style={modalStyles.inputLabel}>Username</Text>
              <TextInput
                autoCapitalize="none"
                value={editUsername}
                onChangeText={setEditUsername}
                style={[modalStyles.input, !usernameValid && modalStyles.inputError]}
                placeholder="username"
                returnKeyType="next"
              />
              {!usernameValid && <Text style={modalStyles.errorText}>Username must be at least 3 characters</Text>}

              <Text style={modalStyles.inputLabel}>Email</Text>
              <TextInput
                keyboardType="email-address"
                autoCapitalize="none"
                value={editEmail}
                onChangeText={setEditEmail}
                style={[modalStyles.input, !emailValid && modalStyles.inputError]}
                placeholder="you@example.com"
                returnKeyType="next"
              />
              {!emailValid && <Text style={modalStyles.errorText}>Enter a valid email address</Text>}

              <Text style={modalStyles.inputLabel}>Phone</Text>
              <TextInput
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
                style={[modalStyles.input, !phoneValid && modalStyles.inputError]}
                placeholder="Optional"
                returnKeyType="done"
              />
              {!phoneValid && <Text style={modalStyles.errorText}>Phone should be at least 7 digits</Text>}

              <Text style={modalStyles.inputLabel}>Address</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  value={editAddress}
                  onChangeText={setEditAddress}
                  style={[modalStyles.input, { flex: 1 }]}
                  placeholder="e.g. Nairobi, Westlands or GPS address"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  accessibilityLabel="Pick location on map"
                  onPress={() => router.push({ pathname: '/location-picker', params: { mode: 'profile' } })}
                  activeOpacity={0.85}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="location" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              {/* Change Password Section */}
              <View style={modalStyles.passwordSection}>
                {!showPwd ? (
                  <TouchableOpacity onPress={() => setShowPwd(true)}>
                    <Text style={modalStyles.link}>Change password</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Text style={modalStyles.inputLabel}>Current password</Text>
                    <View style={{ position: 'relative', width: '100%', overflow: 'visible' }}>
                      <TextInput
                        value={currentPwd}
                        onChangeText={setCurrentPwd}
                        style={[modalStyles.input, { paddingRight: 50 }]}
                        placeholder="Enter current password"
                        secureTextEntry={!showCurrentPwd}
                        returnKeyType="next"
                      />
                      <View
                        pointerEvents="box-none"
                        style={{ 
                          position: 'absolute', 
                          right: 0, 
                          top: 0,
                          bottom: 0,
                          justifyContent: 'center', 
                          alignItems: 'center',
                          width: 50,
                          zIndex: 999,
                          elevation: 999,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => setShowCurrentPwd(!showCurrentPwd)}
                          activeOpacity={0.6}
                          style={{ padding: 10 }}
                        >
                          <Ionicons
                            name={showCurrentPwd ? "eye" : "eye-off"}
                            size={22}
                            color={COLORS.textLight}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={modalStyles.inputLabel}>New password</Text>
                    <View style={{ position: 'relative', width: '100%', overflow: 'visible' }}>
                      <TextInput
                        value={newPwd}
                        onChangeText={setNewPwd}
                        style={[modalStyles.input, { paddingRight: 50 }, showPwd && !passwordValid && modalStyles.inputError]}
                        placeholder="At least 8 characters"
                        secureTextEntry={!showNewPwd}
                        returnKeyType="next"
                      />
                      <View
                        pointerEvents="box-none"
                        style={{ 
                          position: 'absolute', 
                          right: 0, 
                          top: 0,
                          bottom: 0,
                          justifyContent: 'center', 
                          alignItems: 'center',
                          width: 50,
                          zIndex: 999,
                          elevation: 999,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => setShowNewPwd(!showNewPwd)}
                          activeOpacity={0.6}
                          style={{ padding: 10 }}
                        >
                          <Ionicons
                            name={showNewPwd ? "eye" : "eye-off"}
                            size={22}
                            color={COLORS.textLight}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={modalStyles.inputLabel}>Confirm new password</Text>
                    <View style={{ position: 'relative', width: '100%', overflow: 'visible' }}>
                      <TextInput
                        value={confirmPwd}
                        onChangeText={setConfirmPwd}
                        style={[modalStyles.input, { paddingRight: 50 }, showPwd && !passwordValid && modalStyles.inputError]}
                        placeholder="Re-enter new password"
                        secureTextEntry={!showConfirmPwd}
                        returnKeyType="done"
                      />
                      <View
                        pointerEvents="box-none"
                        style={{ 
                          position: 'absolute', 
                          right: 0, 
                          top: 0,
                          bottom: 0,
                          justifyContent: 'center', 
                          alignItems: 'center',
                          width: 50,
                          zIndex: 999,
                          elevation: 999,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => setShowConfirmPwd(!showConfirmPwd)}
                          activeOpacity={0.6}
                          style={{ padding: 10 }}
                        >
                          <Ionicons
                            name={showConfirmPwd ? "eye" : "eye-off"}
                            size={22}
                            color={COLORS.textLight}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {showPwd && !passwordValid && (
                      <Text style={modalStyles.errorText}>Passwords must match and be at least 8 characters</Text>
                    )}
                    <TouchableOpacity style={{ marginTop: 12 }} onPress={() => { setShowPwd(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }}>
                      <Text style={modalStyles.cancelPasswordText}>Cancel password change</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
            {/* Bottom action bar: Save and Cancel */}
            <View style={modalStyles.modalFooter}>
              <TouchableOpacity style={[modalStyles.footerBtn, modalStyles.secondaryBtn]} onPress={() => setEditOpen(false)}>
                <Text style={[modalStyles.buttonText, modalStyles.secondaryBtnText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.button, modalStyles.footerBtn, (saving || !canSubmit) && modalStyles.buttonDisabled]}
                disabled={saving || !canSubmit}
                onPress={handleSave}
              >
                <Text style={modalStyles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet removed */}

      {/* Inline image picking shows spinner via pickingImage state */}
    </>
  )
}

// Removed DetailRow component (no longer used in redesigned UI)

async function pickImageFromLibrary({ base64 = true } = {}) {
  const ImagePicker = await import('expo-image-picker')
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('Permission to access media library was denied')
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker?.MediaType ? [ImagePicker.MediaType.Images] : ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
    base64,
    exif: false,
  })
  if (result.canceled) return null
  const asset = result.assets?.[0]
  if (!asset) return null
  if (base64) {
    if (!asset.base64) return null
    const mime = asset.mimeType || 'image/jpeg'
    const dataUrl = `data:${mime};base64,${asset.base64}`
    return { dataUrl, uri: asset.uri, mime }
  }
  return { uri: asset.uri, mime: asset.mimeType || 'image/jpeg' }
}



