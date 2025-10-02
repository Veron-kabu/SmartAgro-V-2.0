import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import BlurhashImage from '../../components/BlurhashImage'
import { LinearGradient } from 'expo-linear-gradient'
import { useUser } from '@clerk/clerk-expo'
import { useLogout } from '../../hooks/useLogout'
import { useEffect, useState, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useProfile } from '../../context/profile'
import { getJSON, postJSON, patchJSON } from '../../context/api'
import { useDashboardMedia } from '../../hooks/useDashboardMedia'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import { router } from 'expo-router'
import { useToast } from '../../context/toast'

// Floating FabActions removed for farmer: actions integrated into sections

// Shared dashboard for Buyer and Farmer with identical UI; location stays hidden
export default function UserDashboard({ expectedRole = 'buyer', fallbackName = 'User' }) {
  const { user } = useUser()
  const { profile, refresh } = useProfile()
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
  const { avatarUrl, bannerUrl, bannerResolving } = useDashboardMedia(profile)
  const { stats } = useDashboardStats(!loading, 60000)
  // Password change state
  const [showPwd, setShowPwd] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [greeting, setGreeting] = useState('')
  const toast = useToast()
  // Collapsible sections state
  const [openListings, setOpenListings] = useState(true)
  const [openOrders, setOpenOrders] = useState(true)
  const [openFunds, setOpenFunds] = useState(true)
  const [openChat, setOpenChat] = useState(true)
  const [earnings, setEarnings] = useState(null)
  const { signingOut, logout: confirmLogout } = useLogout()
  const collapseKeys = useRef({
    listings: 'dashboard:collapse:listings',
    orders: 'dashboard:collapse:orders',
    funds: 'dashboard:collapse:funds',
    chat: 'dashboard:collapse:chat'
  })

  // Simple currency formatter (later can use Intl if locale / polyfill present)
  const formatCurrency = useCallback((value, currency = (earnings?.currency || 'KES')) => {
    const num = Number(value || 0)
    if (isNaN(num)) return `${currency} 0`
    return `${currency} ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }, [earnings?.currency])

  // Load persisted collapse state
  useEffect(() => {
    (async () => {
      try {
        const keys = Object.values(collapseKeys.current)
        const entries = await AsyncStorage.multiGet(keys)
        const map = Object.fromEntries(entries)
        if (map[collapseKeys.current.listings]) setOpenListings(map[collapseKeys.current.listings] === '1')
        if (map[collapseKeys.current.orders]) setOpenOrders(map[collapseKeys.current.orders] === '1')
        if (map[collapseKeys.current.funds]) setOpenFunds(map[collapseKeys.current.funds] === '1')
        if (map[collapseKeys.current.chat]) setOpenChat(map[collapseKeys.current.chat] === '1')
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
    await refresh()
    return updated
  }, [refresh])

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
      await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': presign.contentType }, body: blob })
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

  // Banner handlers removed (feature deferred)
  const onPickBanner = useCallback(() => {
    toast.show('Banner feature coming soon', { type: 'info' })
  }, [toast])
  // onRemoveBanner intentionally omitted while banner feature disabled

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
      const productsRes = await getJSON(`/api/products?limit=5`)
      const list = Array.isArray(productsRes)
        ? productsRes
        : (Array.isArray(productsRes?.items) ? productsRes.items : [])
      setRecentProducts(list.slice(0, 5))
      if ((profile?.role || expectedRole) === 'farmer') {
        const farmerData = await getJSON(`/api/dashboard/farmer`)
        setDashboardData(farmerData)
        try {
          const earn = await getJSON('/api/earnings/farmer/summary')
          setEarnings(earn)
        } catch (e) {
          console.log('earnings fetch failed', e.message)
        }
      } else {
        setDashboardData(null)
        setEarnings(null)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }, [profile?.role, expectedRole])

  // loadFarmerListings no longer needed (list handled in separate screen)

  useEffect(() => {
    if (!loading) fetchData()
  }, [loading, fetchData])

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
  const isAdminViewingOther = role === 'admin' && role !== expectedRole
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
        {isAdminViewingOther && (
          <View style={{ backgroundColor: '#f59e0b', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginHorizontal: 16, marginTop: 8 }}>
            <Text style={{ color: '#111827', fontSize: 11, fontWeight: '600' }}>Admin view: displaying {expectedRole} layout</Text>
          </View>
        )}
        <View style={styles.heroWrapper}>
          <TouchableOpacity activeOpacity={0.85} onPress={onPickBanner} disabled={pickingImage}>
            {bannerUrl ? (
              <BlurhashImage
                key={bannerUrl || 'banner-placeholder'}
                uri={bannerUrl}
                blurhash={profile?.bannerImageBlurhash}
                style={styles.coverImage}
                onError={async (event) => {
                  const payload = event || {}
                  try { console.log('Banner image load error', payload) } catch {}
                  // Banner disabled: minimal logging only.
                }}
              />
            ) : (
              <LinearGradient colors={['#d1fae5', '#bbf7d0', '#86efac']} style={[styles.coverImage, styles.bannerPlaceholder]} start={{x:0,y:0}} end={{x:1,y:1}}>
                {bannerResolving || pickingImage ? <ActivityIndicator size="small" color="#065f46" /> : null}
                <Text style={styles.bannerPlaceholderText}>Tap to add banner</Text>
              </LinearGradient>
            )}
            <View style={styles.bannerOverlay}>
              <Text style={styles.bannerEditHint}>{bannerUrl ? 'Tap to change banner' : 'Add a farm banner'}</Text>
            </View>
            {/* Banner remove button hidden while feature deferred */}
          </TouchableOpacity>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity onPress={onPickImage} disabled={pickingImage} activeOpacity={0.85}>
              <BlurhashImage uri={avatarUrl || profile?.profileImageUrl || 'https://via.placeholder.com/96'} blurhash={profile?.profileImageBlurhash} style={styles.avatarLarge} />
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

        {/* My Listings Section (collapsible) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <TouchableOpacity style={styles.sectionTitleBtn} onPress={() => setOpenListings(o=>{ const v=!o; persistCollapse('listings', v); return v })} activeOpacity={0.7}>
              <Text style={styles.chevron}>{openListings ? '▾' : '▸'}</Text>
              <Text style={styles.sectionHeading}>My Listings</Text>
            </TouchableOpacity>
            <View style={styles.headerActionsRow}>
              {role === 'farmer' && (
                <TouchableOpacity style={styles.headingActionBtn} activeOpacity={0.85} onPress={() => router.push('/dashboard/post-listing')}>
                  <Text style={styles.headingActionText}>＋ Post</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {openListings && (
            <View style={styles.rowCards}>
              <TouchableOpacity style={styles.listingCard} activeOpacity={0.85} onPress={() => router.push('/dashboard/my-listings')}>
                <ExpoImage source={{ uri: recentProducts[0]?.images?.[0] || 'https://via.placeholder.com/300' }} style={styles.listingImage} contentFit="cover" cachePolicy="memory-disk" placeholder={BLUR_HASH_THUMB} />
                <View style={styles.listingCardFooter}>
                  <Text style={styles.listingLabel}>Available ▶</Text>
                  <Text style={styles.listingMetric}>{(stats?.products?.total ?? dashboardData?.totalProducts) ?? 0}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* Orders Section (collapsible) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <TouchableOpacity style={styles.sectionTitleBtn} onPress={() => setOpenOrders(o=>{ const v=!o; persistCollapse('orders', v); return v })} activeOpacity={0.7}>
              <Text style={styles.chevron}>{openOrders ? '▾' : '▸'}</Text>
              <Text style={styles.sectionHeading}>Orders</Text>
            </TouchableOpacity>
            <View style={styles.headerActionsRow} />
          </View>
          {openOrders && (
            <View style={styles.rowCards}>
              <TouchableOpacity
                style={styles.favoriteCard}
                activeOpacity={0.85}
                onPress={() => router.push(role === 'farmer' ? '/orders/farmerorders' : '/orders/buyerorders')}
              >
                <ExpoImage
                  source={{ uri: 'https://images.unsplash.com/photo-1598515214211-a5c90f6108c7?auto=format&fit=crop&w=400&q=60' }}
                  style={styles.favoriteImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  placeholder={BLUR_HASH_THUMB}
                />
                <Text style={styles.favoriteTitle}>{role === 'farmer' ? 'Incoming Orders' : 'My Orders'}</Text>
                <View style={styles.favoriteMetrics}>
                  <Text style={styles.metricLine}>Active <Text style={styles.metricValue}>{stats?.orders?.active ?? dashboardData?.activeOrders ?? 0}</Text></Text>
                  <Text style={styles.metricLine}>Delivered <Text style={styles.metricValue}>{stats?.orders?.delivered ?? 0}</Text></Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.favoriteCard, { marginRight: 0 }]}
                activeOpacity={0.85}
                onPress={() => router.push('/orders/buyerorders')}
              >
                <ExpoImage
                  source={{ uri: 'https://images.unsplash.com/photo-1560185008-b033106af5c1?auto=format&fit=crop&w=400&q=60' }}
                  style={styles.favoriteImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  placeholder={BLUR_HASH_THUMB}
                />
                <Text style={styles.favoriteTitle}>Sent Orders</Text>
                <View style={styles.favoriteMetrics}>
                  <Text style={styles.metricLine}>Total <Text style={styles.metricValue}>{stats?.ordersSent?.total ?? 0}</Text></Text>
                  <Text style={styles.metricLine}>Completed <Text style={styles.metricValue}>{stats?.ordersSent?.delivered ?? 0}</Text></Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Funds Section (new, only for farmer) */}
        {role === 'farmer' && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <TouchableOpacity style={styles.sectionTitleBtn} onPress={() => setOpenFunds(o=>{ const v=!o; persistCollapse('funds', v); return v })} activeOpacity={0.7}>
                <Text style={styles.chevron}>{openFunds ? '▾' : '▸'}</Text>
                <Text style={styles.sectionHeading}>Funds</Text>
              </TouchableOpacity>
              <View style={styles.headerActionsRow} />
            </View>
            {openFunds && (
              <View style={styles.fundsGrid}>
                <View style={styles.fundCard}>
                  <Text style={styles.fundLabel}>Total Earned</Text>
                  <Text style={styles.fundValue}>{formatCurrency(earnings?.totalRevenue ?? dashboardData?.totalRevenue ?? 0)}</Text>
                </View>
                <View style={styles.fundCard}>
                  <Text style={styles.fundLabel}>Active Orders</Text>
                  <Text style={styles.fundValue}>{stats?.orders?.active ?? dashboardData?.activeOrders ?? 0}</Text>
                </View>
                <View style={styles.fundCard}>
                  <Text style={styles.fundLabel}>Delivered</Text>
                  <Text style={styles.fundValue}>{stats?.orders?.delivered ?? 0}</Text>
                </View>
                <View style={styles.fundCard}>
                  <Text style={styles.fundLabel}>Products</Text>
                  <Text style={styles.fundValue}>{stats?.products?.total ?? dashboardData?.totalProducts ?? 0}</Text>
                </View>
                <TouchableOpacity style={[styles.fundCard, { width: '100%', backgroundColor:'#111827' }]} activeOpacity={0.85} onPress={() => router.push('/dashboard/earnings')}>
                  <Text style={[styles.fundLabel, { color:'#f3f4f6' }]}>View Detailed Earnings & Trends →</Text>
                  <Text style={[styles.fundValue, { color:'#fff', marginTop:6, fontSize:13 }]}>Analyze per‑listing performance</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Chat Section (collapsible) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <TouchableOpacity style={styles.sectionTitleBtn} onPress={() => setOpenChat(o=>{ const v=!o; persistCollapse('chat', v); return v })} activeOpacity={0.7}>
              <Text style={styles.chevron}>{openChat ? '▾' : '▸'}</Text>
              <Text style={styles.sectionHeading}>Chat</Text>
            </TouchableOpacity>
            <View style={styles.headerActionsRow}>
              <TouchableOpacity style={styles.headingActionBtn} activeOpacity={0.85} onPress={() => router.push('/dashboard/messages')}>
                <Text style={styles.headingActionText}>Open Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
          {openChat && (
            <View style={styles.rowCards}>
              <TouchableOpacity style={styles.favoriteCard} activeOpacity={0.85} onPress={() => router.push('/dashboard/messages')}>
                <ExpoImage source={{ uri: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=800&q=60' }} style={styles.favoriteImage} contentFit="cover" cachePolicy="memory-disk" placeholder={BLUR_HASH_THUMB} />
                <Text style={styles.favoriteTitle}>Unread Messages</Text>
                <View style={styles.favoriteMetrics}>
                  <Text style={styles.metricLine}>Unread <Text style={styles.metricValue}>{stats?.messages?.unread ?? 0}</Text></Text>
                  <Text style={styles.metricLine}>Total <Text style={styles.metricValue}>{stats?.messages?.total ?? 0}</Text></Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Switch Role section removed */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <TouchableOpacity
            onPress={confirmLogout}
            disabled={signingOut}
            style={{ backgroundColor: '#dc2626', paddingVertical: 12, borderRadius: 10, alignItems: 'center', opacity: signingOut ? 0.75 : 1 }}
            activeOpacity={0.85}
          >
            {signingOut ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Logging out…</Text>
              </View>
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Log Out</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      {/* FabActions removed: actions now integrated into respective sections for farmer */}

      {/* Edit Profile Modal (full-screen, scrollable, keyboard-aware) */}
      <Modal visible={editOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.editContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditOpen(false)}>
                <Text style={styles.headerAction}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit Profile</Text>
              <View style={{ width: 56 }} />
            </View>
            <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Full name</Text>
              <TextInput
                value={editFullName}
                onChangeText={setEditFullName}
                style={[styles.input, !fullNameValid && styles.inputError]}
                placeholder="e.g. Jane Doe"
                autoFocus
                returnKeyType="next"
              />
              {!fullNameValid && <Text style={styles.errorText}>Please enter at least 2 characters</Text>}

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Username</Text>
              <TextInput
                autoCapitalize="none"
                value={editUsername}
                onChangeText={setEditUsername}
                style={[styles.input, !usernameValid && styles.inputError]}
                placeholder="username"
                returnKeyType="next"
              />
              {!usernameValid && <Text style={styles.errorText}>Username must be at least 3 characters</Text>}

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Email</Text>
              <TextInput
                keyboardType="email-address"
                autoCapitalize="none"
                value={editEmail}
                onChangeText={setEditEmail}
                style={[styles.input, !emailValid && styles.inputError]}
                placeholder="you@example.com"
                returnKeyType="next"
              />
              {!emailValid && <Text style={styles.errorText}>Enter a valid email address</Text>}

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Phone</Text>
              <TextInput
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
                style={[styles.input, !phoneValid && styles.inputError]}
                placeholder="Optional"
                returnKeyType="done"
              />
              {!phoneValid && <Text style={styles.errorText}>Phone should be at least 7 digits</Text>}

              {/* Change Password Section */}
              <View style={{ marginTop: 16 }}>
                {!showPwd ? (
                  <TouchableOpacity onPress={() => setShowPwd(true)}>
                    <Text style={styles.link}>Change password</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>Current password</Text>
                    <TextInput
                      value={currentPwd}
                      onChangeText={setCurrentPwd}
                      style={styles.input}
                      placeholder="Enter current password"
                      secureTextEntry
                      returnKeyType="next"
                    />
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>New password</Text>
                    <TextInput
                      value={newPwd}
                      onChangeText={setNewPwd}
                      style={[styles.input, showPwd && !passwordValid && styles.inputError]}
                      placeholder="At least 8 characters"
                      secureTextEntry
                      returnKeyType="next"
                    />
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>Confirm new password</Text>
                    <TextInput
                      value={confirmPwd}
                      onChangeText={setConfirmPwd}
                      style={[styles.input, showPwd && !passwordValid && styles.inputError]}
                      placeholder="Re-enter new password"
                      secureTextEntry
                      returnKeyType="done"
                    />
                    {showPwd && !passwordValid && (
                      <Text style={styles.errorText}>Passwords must match and be at least 8 characters</Text>
                    )}
                    <TouchableOpacity style={{ marginTop: 8 }} onPress={() => { setShowPwd(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }}>
                      <Text style={[styles.muted]}>Cancel password change</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
            {/* Bottom action bar: Save and Cancel */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.button, styles.secondaryBtn, styles.footerBtn]} onPress={() => setEditOpen(false)}>
                <Text style={[styles.buttonText, styles.secondaryBtnText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.footerBtn, (saving || !canSubmit) && { opacity: 0.7 }]}
                disabled={saving || !canSubmit}
                onPress={handleSave}
              >
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { paddingBottom: 32 },
  heroWrapper: { position: 'relative', width: '100%', height: 180, backgroundColor: '#e5e7eb' },
  coverImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 6, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  bannerEditHint: { color: '#fff', fontSize: 10, letterSpacing: 0.5 },
  avatarWrapper: { position: 'absolute', bottom: -48, left: 0, right: 0, alignItems: 'center' },
  avatarLarge: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: '#fff', backgroundColor: '#d1d5db' },
  profileInfo: { marginTop: 56, alignItems: 'center', paddingHorizontal: 16 },
  nameLarge: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 4 },
  username: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  editProfileBtn: { backgroundColor: '#9ca3af', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 24, marginTop: 16 },
  editProfileText: { color: '#fff', fontWeight: '600', fontSize: 12, letterSpacing: 0.5 },
  sectionBlock: { marginTop: 32, paddingHorizontal: 16 },
  sectionHeading: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  rowCards: { flexDirection: 'row', justifyContent: 'space-between' },
  listingCard: { flex: 1, marginRight: 12, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 2 },
  listingImage: { width: '100%', height: 110 },
  listingCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  listingLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  listingMetric: { fontSize: 12, fontWeight: '700', color: '#111827' },
  favoriteCard: { flex: 1, marginRight: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, elevation: 2 },
  favoriteImage: { width: '100%', height: 70, borderRadius: 12, marginBottom: 10 },
  favoriteTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 12 },
  favoriteMetrics: { gap: 6 },
  metricLine: { fontSize: 11, color: '#6b7280' },
  metricValue: { fontWeight: '700', color: '#111827' },
  favoriteCardLast: { marginRight: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e5e7eb' },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  muted: { color: '#6b7280', fontSize: 12 },
  greeting: { fontSize: 16, fontWeight: '700', color: '#111827' },
  tag: { fontSize: 10, color: '#16a34a', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start' },
  link: { color: '#16a34a', fontWeight: '600' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  inputLabel: { fontSize: 12, color: '#6b7280', marginTop: 12 },
  button: { backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#f3f4f6' },
  secondaryBtnText: { color: '#111827' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomColor: '#f3f4f6', borderBottomWidth: 1 },
  detailLabel: { color: '#6b7280', fontSize: 12, flex: 0.45 },
  detailValue: { color: '#111827', fontSize: 12, flex: 0.55, textAlign: 'right' },
  editContainer: { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader: { paddingTop: Platform.OS === 'ios' ? 52 : 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomColor: '#e5e7eb', borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerAction: { color: '#16a34a', fontWeight: '700' },
  headerActionDisabled: { color: '#9ca3af' },
  editContent: { padding: 16 },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  modalFooter: { padding: 16, backgroundColor: '#fff', borderTopColor: '#e5e7eb', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  footerBtn: { alignSelf: 'auto', flex: 1, alignItems: 'center' },
  bold: { fontWeight: '700' },
  // Added styles for stats and sections
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 8 },
  statCard: { flex: 1, backgroundColor: '#f3f4f6', marginHorizontal: 4, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 4 },
  statLabel: { fontSize: 12, color: '#6b7280' },
  section: { backgroundColor: '#fff', margin: 16, marginTop: 12, padding: 16, borderRadius: 12, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  seeAllText: { color: '#16a34a', fontWeight: '600' },
  productCard: { width: 140, marginRight: 12, backgroundColor: '#fff', borderRadius: 12, padding: 8, elevation: 1, borderColor: '#e5e7eb', borderWidth: 1 },
  productImage: { width: 124, height: 84, borderRadius: 8, backgroundColor: '#e5e7eb' },
  productTitle: { fontSize: 12, fontWeight: '600', color: '#111827', marginTop: 6 },
  productPrice: { fontSize: 12, color: '#16a34a', marginTop: 2 },
  productLocation: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  // Floating action bar for farmer quick actions
  fabBar: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  fabPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, marginHorizontal: 4 },
  fabIcon: { color: '#fff', fontSize: 14, marginRight: 6 },
  fabLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  // New collapsible / header action styles
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleBtn: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  chevron: { fontSize: 14, color: '#374151', marginRight: 4 },
  headerActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingActionBtn: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginLeft: 8 },
  headingActionText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  fundsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  fundCard: { width: '47%', backgroundColor: '#fff', padding: 12, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  fundLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  fundValue: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 4 },
  // Bottom sheet styles
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheetBackdropTouchable: { flex: 1 },
  sheetContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingHorizontal: 16, paddingTop: 6 },
  sheetHandleWrapper: { alignItems: 'center', paddingVertical: 6 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#e5e7eb' },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  sheetTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sheetClose: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  sheetRowTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  sheetRowPrice: { fontSize: 11, color: '#16a34a', marginTop: 2 },
  sheetEditBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f3f4f6', borderRadius: 16 },
  sheetEditText: { fontSize: 11, fontWeight: '600', color: '#111827' },
})
