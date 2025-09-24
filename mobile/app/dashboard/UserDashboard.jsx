import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert, Modal, SectionList, Platform, KeyboardAvoidingView, ScrollView } from 'react-native'
import { useUser } from '@clerk/clerk-expo'
import { useEffect, useState, useCallback } from 'react'
import { useProfile } from '../../context/profile'
import RoleSwitcher from '../../components/RoleSwitcher'
import { getJSON, postJSON, patchJSON } from '../../context/api'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

// Shared dashboard for Buyer and Farmer with identical UI; location stays hidden
export default function UserDashboard({ expectedRole = 'buyer', title = 'User Profile', fallbackName = 'User' }) {
  const { user } = useUser()
  const { profile, refresh } = useProfile()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)
  const [recentProducts, setRecentProducts] = useState([])
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editEmail, setEditEmail] = useState(profile?.email || '')
  const [editUsername, setEditUsername] = useState(profile?.username || '')
  const [editPhone, setEditPhone] = useState(profile?.phone || '')
  const [editFullName, setEditFullName] = useState(profile?.fullName || '')
  const [pickingImage, setPickingImage] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  // Password change state
  const [showPwd, setShowPwd] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [greeting, setGreeting] = useState('')

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
      try {
        const q = encodeURIComponent(presign.publicUrl)
        const resolved = await getJSON(`/api/uploads/resolve-avatar-url?url=${q}`)
        setAvatarUrl(resolved?.url || presign.publicUrl)
      } catch { /* ignore */ }
      Alert.alert('Updated', 'Profile image updated')
    } catch (e) {
      Alert.alert('Image', e?.message || 'Failed to update image')
    } finally {
      setPickingImage(false)
    }
  }, [pickingImage, patchProfile])

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
      setRecentProducts(productsRes?.slice(0, 5) || [])
      if ((profile?.role || expectedRole) === 'farmer') {
        const farmerData = await getJSON(`/api/dashboard/farmer`)
        setDashboardData(farmerData)
      } else {
        setDashboardData(null)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }, [profile?.role, expectedRole])

  useEffect(() => {
    if (!loading) fetchData()
  }, [loading, fetchData])

  // Resolve initial avatar URL when profile changes (do not touch edit fields here)
  useEffect(() => {
    ;(async () => {
      try {
        const raw = profile?.profileImageUrl || null
        if (!raw) { setAvatarUrl(null); return }
        const q = encodeURIComponent(raw)
        const resolved = await getJSON(`/api/uploads/resolve-avatar-url?url=${q}`)
        setAvatarUrl(resolved?.url || raw)
      } catch {
        setAvatarUrl(profile?.profileImageUrl || null)
      }
    })()
  }, [profile])

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

  // Periodically refresh the resolved avatar URL so signed URLs don't expire while viewing
  useEffect(() => {
    const raw = profile?.profileImageUrl
    if (!raw) return
    let active = true
    let timer = null

    async function scheduleNext() {
      if (!active) return
      try {
        const q = encodeURIComponent(raw)
        const resolved = await getJSON(`/api/uploads/resolve-avatar-url?url=${q}`)
        if (active) setAvatarUrl(resolved?.url || raw)
        const ttlSec = Number(resolved?.ttlSeconds)
        // refresh 20% before TTL expires, fallback to 4 minutes if not provided
        const refreshMs = Number.isFinite(ttlSec) ? Math.max(10_000, Math.floor(ttlSec * 1000 * 0.8)) : 4 * 60 * 1000
        timer = setTimeout(scheduleNext, refreshMs)
      } catch {
        // On failure, try again in 1 minute
        timer = setTimeout(scheduleNext, 60 * 1000)
      }
    }

    scheduleNext()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [profile?.profileImageUrl])

  const role = profile?.role || expectedRole

  const goToOrders = useCallback(() => router.push('/orders'), [])

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
        Alert.alert('Password updated', 'Your password has been changed')
      }
      if (hasChanges) {
        await patchProfile({ full_name: editFullName, username: editUsername, email: editEmail, phone: editPhone })
      }
      setEditOpen(false)
      if (hasChanges && !hasPasswordChange) {
        Alert.alert('Saved', 'Profile updated')
      }
    } catch (e) {
      const field = e?.body ? (() => { try { const j = JSON.parse(e.body); return j.field } catch { return null } })() : null
      const msg = e?.message || 'Failed to save'
      Alert.alert(field ? `Conflict: ${field}` : 'Error', field ? `${field} already in use` : msg)
    } finally {
      setSaving(false)
    }
  }, [canSubmit, saving, hasPasswordChange, hasChanges, changePassword, editFullName, editUsername, editEmail, editPhone, patchProfile])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading {expectedRole} dashboard…</Text>
      </View>
    )
  }

  if (role !== expectedRole) {
    const roleTitle = expectedRole === 'farmer' ? 'Farmers' : 'Buyers'
    return (
      <View style={styles.center}>
        <Text style={styles.sectionTitle}>This page is for {roleTitle}</Text>
        <Text style={{ marginTop: 8 }}>Current role: {role}</Text>
        <View style={{ marginTop: 16 }}>
          <RoleSwitcher />
        </View>
      </View>
    )
  }

  const sections = [
    { key: 'profile', title: null, data: [{ type: 'profile' }] },
    { key: 'role', title: null, data: [{ type: 'role' }] },
  ]

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => String(item?.id ?? item?.type ?? index)}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderSectionHeader={() => null}
        ListFooterComponent={() => (
          <View>
            {(profile?.role || expectedRole) === 'farmer' && dashboardData && (
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Ionicons name="leaf" size={24} color="#16a34a" />
                  <Text style={styles.statNumber}>{dashboardData.totalProducts}</Text>
                  <Text style={styles.statLabel}>Products</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="receipt" size={24} color="#f59e0b" />
                  <Text style={styles.statNumber}>{dashboardData.activeOrders}</Text>
                  <Text style={styles.statLabel}>Active Orders</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="cash" size={24} color="#10b981" />
                  <Text style={styles.statNumber}>${dashboardData.totalRevenue}</Text>
                  <Text style={styles.statLabel}>Revenue</Text>
                </View>
              </View>
            )}

            {recentProducts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Fresh Products</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {recentProducts.map((product) => (
                    <TouchableOpacity key={product.id} style={styles.productCard}>
                      <Image
                        source={{ uri: product.images?.[0] || 'https://via.placeholder.com/120' }}
                        style={styles.productImage}
                      />
                      <Text style={styles.productTitle} numberOfLines={2}>
                        {product.title}
                      </Text>
                      <Text style={styles.productPrice}>
                        ${product.price}/{product.unit}
                      </Text>
                      <Text style={styles.productLocation}>{product.location}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
        renderItem={({ item, section }) => {
          if (section.key === 'profile') {
            return (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>{title}</Text>
                </View>
                <View style={styles.profileRow}>
                  <TouchableOpacity onPress={onPickImage} disabled={pickingImage} activeOpacity={0.8}>
                    <Image source={{ uri: avatarUrl || profile?.profileImageUrl || 'https://via.placeholder.com/64' }} style={styles.avatar} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    {!!greeting && <Text style={styles.greeting}>{greeting}</Text>}
                    <Text style={styles.name}>{profile?.fullName || profile?.username || fallbackName}</Text>
                    <Text style={styles.muted}>@{profile?.username || 'username'}</Text>
                    <Text style={[styles.tag, { marginTop: 6 }]}>{(profile?.role || expectedRole).toUpperCase()}</Text>
                    {/* Location hidden by request: do not display coordinates or address here */}
                  </View>
                </View>

                {/* Details grid (hide created/updated/emailVerified) */}
                <View style={{ marginTop: 12 }}>
                  <DetailRow label="Email" value={profile?.email || '—'} />
                  <DetailRow label="Phone" value={profile?.phone || '—'} />
                  <DetailRow label="Status" value={profile?.status || '—'} />
                </View>

                {/* Actions: Edit profile and View Orders */}
                <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={styles.button} onPress={openEditModal}>
                    <Text style={styles.buttonText}>Edit Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryBtn]}
                    onPress={goToOrders}
                  >
                    <Text style={[styles.buttonText, styles.secondaryBtnText]}>View Orders</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          }
          if (section.key === 'role') {
            return (
              <View style={[styles.card, { marginBottom: 24 }]}>
                <Text style={styles.sectionTitle}>Switch Role</Text>
                <View style={{ marginTop: 8 }}>
                  <RoleSwitcher />
                </View>
              </View>
            )
          }
          return null
        }}
        stickySectionHeadersEnabled={false}
      />

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

      {/* Inline image picking shows spinner via pickingImage state */}
    </>
  )
}

function DetailRow({ label, value, ellipsize = false }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue]} numberOfLines={ellipsize ? 1 : undefined}>{value ?? '—'}</Text>
    </View>
  )
}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
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
})
