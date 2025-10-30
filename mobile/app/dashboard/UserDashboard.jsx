import { View, Text, TouchableOpacity, TextInput, Alert, Modal, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native'
// import { Image as ExpoImage } from 'expo-image'
import BlurhashImage from '../../components/BlurhashImage'
import { LinearGradient } from 'expo-linear-gradient'
import { useUser } from '@clerk/clerk-expo'
import { useLogout } from '../../hooks/useLogout'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useProfile } from '../../context/profile'
import { getJSON, postJSON, patchJSON } from '../../context/api'
import { useDashboardMedia } from '../../hooks/useDashboardMedia'
// useDashboardStats removed
import { router, useFocusEffect } from 'expo-router'
import CountBadge from '../../components/CountBadge'
import { useChat } from '../../context/chat'
import VerificationBanner from '../../components/VerificationBanner'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
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
  const [dashboardData, setDashboardData] = useState(null)
  const [recentProducts, setRecentProducts] = useState([])
  // Removed inline/bottom-sheet listings usage; dedicated screen navigation instead
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editEmail, setEditEmail] = useState(profile?.email || '')
  const [editUsername, setEditUsername] = useState(profile?.username || '')
  const [editPhone, setEditPhone] = useState(profile?.phone || '')
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
    if ((type === 'review_created' || type === 'review_commented') && data.reviewId) {
      try { router.push({ pathname: '/reviews/[id]', params: { id: String(data.reviewId) } }) } catch {}
      setNotifOpen(false)
      return
    }
    if ((type === 'moderation' || type === 'account_suspended') && data?.route && String(data.route).includes('/appeals')) {
      const params = data?.reportId ? { reportId: String(data.reportId) } : {}
      try { router.push({ pathname: '/appeals', params }) } catch {}
      setNotifOpen(false)
      return
    }
    // Fallback: verification notifications keep current behavior
    if (type === 'verification_status' && data?.submissionId) {
      // Optionally navigate to verification screen if it exists
      try { router.push('/verification') } catch {}
      setNotifOpen(false)
    }
  }, [])

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
  // Dashboard listing thumbnail (random from recent products)
  const [listingThumbRaw, setListingThumbRaw] = useState(null)
  const [listingThumb] = useResolvedUrls(listingThumbRaw ? [listingThumbRaw] : [])
  // Password change state
  const [showPwd, setShowPwd] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [greeting, setGreeting] = useState('')
  const toast = useToast()
  // Collapsible sections state
  const [openListings, setOpenListings] = useState(true)
  // const [openOrders, setOpenOrders] = useState(true) // replaced by single Orders button
  // Collapsible Funds section removed; single Funds button links to Funds hub
  const { signingOut, logout: confirmLogout } = useLogout()
  const collapseKeys = useRef({
    listings: 'dashboard:collapse:listings',
  })

  // Banner image error handling guards to prevent endless retry loops
  const bannerRetryRef = useRef(0)
  const bannerResolveBusyRef = useRef(false)
  const bannerLogOnceRef = useRef(false)

  // Simple currency formatter (later can use Intl if locale / polyfill present)
  // formatCurrency removed with old Funds metrics section

  // Load persisted collapse state
  useEffect(() => {
    (async () => {
      try {
        const keys = Object.values(collapseKeys.current)
        const entries = await AsyncStorage.multiGet(keys)
        const map = Object.fromEntries(entries)
        if (map[collapseKeys.current.listings]) setOpenListings(map[collapseKeys.current.listings] === '1')
      } catch (e) {
        console.log('collapse restore failed', e.message)
      }
    })()
  }, [])

  const persistCollapse = useCallback((key, open) => {
    const storageKey = collapseKeys.current[key]
    AsyncStorage.setItem(storageKey, open ? '1' : '0').catch(()=>{})
  }, [])

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
  const openBannerActions = useCallback(() => {
    Alert.alert(
      'Banner',
      'Choose an action',
      [
        { text: 'Change', onPress: () => onPickBanner() },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveBanner() },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }, [onPickBanner, onRemoveBanner])

  const onRemoveAvatar = useCallback(async () => {
    try {
      await patchProfile({ profile_image_url: null, profile_image_blurhash: null })
      toast.show('Profile image removed', { type: 'success' })
    } catch (e) {
      toast.show(e?.message || 'Failed to remove profile image', { type: 'error' })
    }
  }, [patchProfile, toast])

  const openAvatarActions = useCallback(() => {
    Alert.alert(
      'Profile photo',
      'Choose an action',
      [
        { text: 'Change', onPress: () => onPickImage() },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveAvatar() },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }, [onPickImage, onRemoveAvatar])

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
      if ((profile?.role || expectedRole) === 'farmer') {
        const farmerData = await getJSON(`/api/dashboard/farmer`)
        setDashboardData(farmerData)
      } else {
        setDashboardData(null)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }, [profile?.role, expectedRole, profile?.id])

  // loadFarmerListings no longer needed (list handled in separate screen)

  useEffect(() => {
    if (!loading) fetchData()
  }, [loading, fetchData])

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
    let next = listingThumbRaw
    // Try a few times to avoid picking the same image when we have options
    for (let attempt = 0; attempt < 5; attempt++) {
      const idx = Math.floor(Math.random() * withImages.length)
      const candidate = withImages[idx].images[0]
      if (candidate && candidate !== listingThumbRaw) {
        next = candidate
        break
      }
      // If we only have one option or keep hitting the same, accept it on the last try
      if (attempt === 4) next = candidate
    }
    setListingThumbRaw(next || null)
  }, [recentProducts, listingThumbRaw])

  // When recentProducts change, (re)seed the random listing image
  useEffect(() => {
    pickRandomListingThumb()
  }, [recentProducts, pickRandomListingThumb])

  // (Removed inline avatar/banner/stats effects in favor of hooks)

  // Prepare edit fields only when opening the modal, so typing isn't overwritten
  const openEditModal = useCallback(() => {
    setEditEmail(profile?.email || '')
    setEditUsername(profile?.username || '')
    setEditPhone(profile?.phone || '')
    setEditFullName(profile?.fullName || profile?.username || '')
    setEditOpen(true)
  }, [profile])

  // When the modal becomes visible, prefill from the latest profile as a safety net
  useEffect(() => {
    if (!editOpen) return
    setEditEmail(profile?.email || '')
    setEditUsername(profile?.username || '')
    setEditPhone(profile?.phone || '')
    setEditFullName(profile?.fullName || profile?.username || '')
  }, [editOpen, profile])

  // Avatar refresh handled by useDashboardMedia hook

  const role = profile?.role || expectedRole

  // Orders navigation removed in new UI layout (add back if needed)

  // ---------- Edit form derived state & actions ----------
  const emailValid = !editEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)
  const usernameValid = (editUsername || '').trim().length >= 3
  const fullNameValid = (editFullName || '').trim().length >= 2
  const phoneValid = !editPhone || (editPhone || '').trim().length >= 7
  const passwordValid = !showPwd || ((newPwd || '').length >= 8 && newPwd === confirmPwd)
  const isValid = emailValid && usernameValid && fullNameValid && phoneValid && passwordValid

  const hasChanges = (
    (editFullName || '') !== (profile?.fullName || '') ||
    (editUsername || '') !== (profile?.username || '') ||
    (editEmail || '') !== (profile?.email || '') ||
    (editPhone || '') !== (profile?.phone || '')
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
        await patchProfile({ full_name: editFullName, username: editUsername, email: editEmail, phone: editPhone })
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
  }, [canSubmit, saving, hasPasswordChange, hasChanges, changePassword, editFullName, editUsername, editEmail, editPhone, patchProfile, toast])

  // logout logic moved to shared hook useLogout

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading {expectedRole} dashboard…</Text>
      </View>
    )
  }

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
          <TouchableOpacity activeOpacity={0.85} onPress={onPickBanner} disabled={pickingImage}>
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
              {/* Messages quick access button */}
              <TouchableOpacity
                accessibilityLabel="Open messages"
                onPress={() => router.push('/chat')}
                activeOpacity={0.85}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ position: 'absolute', right: 48, top: -12, zIndex: 5, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 6 }}
              >
                <Ionicons name="chatbubbles" size={20} color={COLORS.primary} />
                {unreadTotal > 0 && (
                  <CountBadge
                    count={unreadTotal}
                    max={99}
                    size={18}
                    style={{ position: 'absolute', top: -6, right: -8 }}
                  />
                )}
              </TouchableOpacity>
              {totalBadge > 0 && (
                <TouchableOpacity
                  accessibilityLabel="Open notifications"
                  onPress={() => { setNotifOpen(true); loadNotifications() }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{ position: 'absolute', right: 12, top: -12, zIndex: 5 }}
                >
                  <CountBadge
                    count={totalBadge}
                    max={99}
                    size={20}
                    minWidth={20}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={openBannerActions} activeOpacity={0.85} style={{ position: 'absolute', right: 12, bottom: 8, padding: 6 }} accessibilityLabel="Banner actions">
                <Ionicons name="ellipsis-horizontal-circle" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {/* Banner remove button hidden while feature deferred */}
          </TouchableOpacity>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity onPress={onPickImage} disabled={pickingImage} activeOpacity={0.85}>
              <BlurhashImage uri={avatarUrl || profile?.profileImageUrl || 'https://via.placeholder.com/96'} blurhash={profile?.profileImageBlurhash} style={styles.avatarLarge} />
            </TouchableOpacity>
            {/* Avatar actions icon */}
            <TouchableOpacity onPress={openAvatarActions} activeOpacity={0.85} style={{ position: 'absolute', right: '25%', bottom: -10, padding: 6 }} accessibilityLabel="Profile photo actions">
              <Ionicons name="ellipsis-horizontal-circle" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.profileInfo}>
          {!!greeting && <Text style={styles.greeting}>{greeting}</Text>}
          <Text style={styles.nameLarge}>{profile?.fullName || profile?.username || fallbackName}</Text>
          <Text style={styles.username}>@{profile?.username || 'username'}</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={openEditModal} activeOpacity={0.8}>
            <Text style={styles.editProfileText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

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

  {/* My Listings Section (collapsible) - Farmers only */}
  {role === 'farmer' && (
  <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <TouchableOpacity style={styles.sectionTitleBtn} onPress={() => setOpenListings(o=>{ const v=!o; persistCollapse('listings', v); if (v) { pickRandomListingThumb() }; return v })} activeOpacity={0.7}>
              <Text style={styles.chevron}>{openListings ? '▾' : '▸'}</Text>
              <Text style={styles.sectionHeading}>My Listings</Text>
            </TouchableOpacity>
            <View style={styles.headerActionsRow}>
              {role === 'farmer' && (
                <TouchableOpacity style={styles.headingActionBtn} activeOpacity={0.85} onPress={() => router.push('/products/post-listing')}>
                  <Text style={styles.headingActionText}>＋ Post</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {openListings && (
            <View style={styles.rowCards}>
              <TouchableOpacity style={styles.listingCard} activeOpacity={0.85} onPress={() => router.push('/products/my-listings')}>
                <BlurhashImage
                  uri={listingThumb || listingThumbRaw || 'https://via.placeholder.com/300'}
                  style={styles.listingImage}
                  contentFit="cover"
                  placeholder={BLUR_HASH_THUMB}
                />
                <View style={styles.listingCardFooter}>
                  <Text style={styles.listingLabel}>Available </Text>
                  <Text style={styles.listingMetric}>{(dashboardData?.totalProducts) ?? 0}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
  </View>
  )}
  {/* Orders: single action button (hidden for admin) */}
        {role !== 'admin' && (
          <View style={styles.sectionBlock}>
            <TouchableOpacity
              style={styles.ordersButton}
              activeOpacity={0.9}
              onPress={() => router.push('/orders')}
              accessibilityLabel="Orders"
            >
              <Ionicons name={role === 'farmer' ? 'newspaper-outline' : 'paper-plane-outline'} size={18} color={COLORS.white} style={styles.ordersButtonIcon} />
              <Text style={styles.ordersButtonText}>Orders</Text>
            </TouchableOpacity>
            <Text style={styles.ordersButtonHint}>Incoming • Sent • Current • Completed</Text>
          </View>
        )}

        {/* Funds: single action button like Orders (farmer only) */}
        {role === 'farmer' && (
          <View style={styles.sectionBlock}>
            <TouchableOpacity
              style={styles.ordersButton}
              activeOpacity={0.9}
              onPress={() => router.push('/funds')}
              accessibilityLabel="Funds"
            >
              <Ionicons name={'wallet-outline'} size={18} color={COLORS.white} style={styles.ordersButtonIcon} />
              <Text style={styles.ordersButtonText}>Funds</Text>
            </TouchableOpacity>
            <Text style={styles.ordersButtonHint}>Earnings • Transactions • Withdrawals</Text>
          </View>
        )}

        {/* Collapsible Funds metrics section removed (replaced by Funds hub button) */}

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
      <Modal visible={editOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditOpen(false)}>
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

              {/* Change Password Section */}
              <View style={modalStyles.passwordSection}>
                {!showPwd ? (
                  <TouchableOpacity onPress={() => setShowPwd(true)}>
                    <Text style={modalStyles.link}>Change password</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Text style={modalStyles.inputLabel}>Current password</Text>
                    <TextInput
                      value={currentPwd}
                      onChangeText={setCurrentPwd}
                      style={modalStyles.input}
                      placeholder="Enter current password"
                      secureTextEntry
                      returnKeyType="next"
                    />
                    <Text style={modalStyles.inputLabel}>New password</Text>
                    <TextInput
                      value={newPwd}
                      onChangeText={setNewPwd}
                      style={[modalStyles.input, showPwd && !passwordValid && modalStyles.inputError]}
                      placeholder="At least 8 characters"
                      secureTextEntry
                      returnKeyType="next"
                    />
                    <Text style={modalStyles.inputLabel}>Confirm new password</Text>
                    <TextInput
                      value={confirmPwd}
                      onChangeText={setConfirmPwd}
                      style={[modalStyles.input, showPwd && !passwordValid && modalStyles.inputError]}
                      placeholder="Re-enter new password"
                      secureTextEntry
                      returnKeyType="done"
                    />
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
    allowsEditing: true,
    aspect: [1, 1],
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


// Simple blurhash constants (can be replaced with generated per-image blurhash later)
const BLUR_HASH_THUMB = 'L5H2EC=PM+yV0g-mq.wG9c010J}I'
