import { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image, Linking, Platform, StyleSheet } from 'react-native'
import { getJSON } from '../../context/api'
import { on as onEvent } from '../../utils/eventBus'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
import { COLORS } from '../../constants/colors'
import { productDetailStyles as pstyles } from '../../assets/styles/products.styles'

function Row({ item }) {
  const statusColor = item.status === 'approved' ? '#16a34a' : item.status === 'rejected' ? '#dc2626' : item.status === 'flagged' ? '#f59e0b' : '#2563eb'
  const img0 = Array.isArray(item.images) ? item.images[0] : null
  const thumbUrl = img0?.displayUrl || img0?.url || null
  const [resolvedThumb] = useResolvedUrls(thumbUrl ? [thumbUrl] : [])
  const lat = img0?.lat, lng = img0?.lng
  const openMap = () => {
    if (lat != null && lng != null) {
      const url = Platform.select({ ios: `http://maps.apple.com/?ll=${lat},${lng}`, android: `geo:${lat},${lng}?q=${lat},${lng}`, default: `https://www.google.com/maps?q=${lat},${lng}` })
      Linking.openURL(url).catch(()=>{})
    }
  }
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/verification/verification-reviews/[id]', params: { id: String(item.id) } })}
      style={{ backgroundColor: '#FFFFFF', marginBottom: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {resolvedThumb ? (
          <Image source={{ uri: resolvedThumb }} style={{ width: 56, height: 56, backgroundColor: '#F1F5F9', borderRadius: 10, marginRight: 14 }} />
        ) : (
          <View style={{ width: 56, height: 56, backgroundColor: '#F1F5F9', borderRadius: 10, marginRight: 14 }} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: '#111827' }}>#{item.id} · {item.userEmail || '—'}</Text>
          <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: statusColor }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{item.status}</Text>
        </View>
      </View>
      {item.awaitingSecondApproval && (
        <View style={{ marginTop: 10, backgroundColor: '#FEF3C7', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' }}>
          <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '600' }}>Awaiting second approval{item.firstReviewerId ? ` · first by #${item.firstReviewerId}` : ''}</Text>
        </View>
      )}
      {lat != null && lng != null ? (
        <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={openMap} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Open map">
            <Ionicons name="location" size={14} color={'#1E3A8A'} />
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

function GroupRow({ group, status }) {
  const statusColor = status === 'approved' ? '#16a34a' : status === 'rejected' ? '#dc2626' : status === 'flagged' ? '#f59e0b' : '#2563eb'
  // Use the most recent item's first image as a thumbnail if present
  const latest = group.itemsSorted[0]
  const img0 = Array.isArray(latest?.images) ? latest.images[0] : null
  const thumbUrl = img0?.displayUrl || img0?.url || null
  const [resolvedThumb] = useResolvedUrls(thumbUrl ? [thumbUrl] : [])
  const count = group.count
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/verification/verification-reviews/group', params: { userId: String(group.userId), status, email: group.userEmail || '' } })}
      style={{ backgroundColor: '#FFFFFF', marginBottom: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {resolvedThumb ? (
          <Image source={{ uri: resolvedThumb }} style={{ width: 56, height: 56, backgroundColor: '#F1F5F9', borderRadius: 10, marginRight: 14 }} />
        ) : (
          <View style={{ width: 56, height: 56, backgroundColor: '#F1F5F9', borderRadius: 10, marginRight: 14 }} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: '#111827' }}>{group.userEmail || '—'}</Text>
          <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{count} submissions · latest {new Date(group.latestCreatedAt).toLocaleString()}</Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: statusColor }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// Module cache for fast subsequent opens
let cachedVerifications = global.__cached_verifications__
const DEFAULT_VERIFICATIONS = []

export default function VerificationReviewsList() {
  const [items, setItems] = useState(cachedVerifications || DEFAULT_VERIFICATIONS)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState('pending')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all verifications once and filter client-side to avoid
      // triggering a network request on every status button press.
      const data = await getJSON(`/api/admin/verifications`)
      const rows = data?.items || []
      setItems(rows)
      try { global.__cached_verifications__ = rows } catch {}
    } catch (e) {
      console.log('fetch verifs failed', e?.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  useEffect(() => { fetchData() }, [fetchData])

  // Live-update the list when a submission is approved/rejected elsewhere
  useEffect(() => {
    const off = onEvent('verification:update', (payload) => {
      // Simpler and correct for grouping: refetch to recompute groups/counts
      fetchData()
    })
    return () => { try { off && off() } catch {} }
  }, [status, fetchData])

  // Filter locally based on the selected status to prevent refetches
  const filtered = (items || []).filter(it => String(it.status || '').toLowerCase() === String(status || '').toLowerCase())

  // Group by userId within the current status view; single stays as-is
  const groupedData = useMemo(() => {
    if (!Array.isArray(filtered) || filtered.length === 0) return []
    const byUser = new Map()
    for (const it of filtered) {
      const key = String(it.userId)
      if (!byUser.has(key)) byUser.set(key, [])
      byUser.get(key).push(it)
    }
    const out = []
    for (const [userId, arr] of byUser.entries()) {
      if (arr.length === 1) {
        out.push({ type: 'single', item: arr[0] })
        continue
      }
      const itemsSorted = [...arr].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      const latestCreatedAt = itemsSorted[0]?.createdAt || arr[0]?.createdAt
      const userEmail = itemsSorted[0]?.userEmail || arr[0]?.userEmail || null
      out.push({ type: 'group', userId: Number(userId), userEmail, count: arr.length, latestCreatedAt, itemsSorted })
    }
    // Sort: groups first by latest date, then singles by createdAt
    return out.sort((a,b) => {
      const aDate = a.type === 'group' ? new Date(a.latestCreatedAt) : new Date(a.item.createdAt)
      const bDate = b.type === 'group' ? new Date(b.latestCreatedAt) : new Date(b.item.createdAt)
      return bDate - aDate
    })
  }, [filtered])

  const localHeaderStyles = StyleSheet.create({
    header: {
      height: 34,
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: -8,
      justifyContent: 'space-between',
      paddingHorizontal: 10,
    },
    leftBtn: { padding: 6 },
    title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    rightActions: { flexDirection: 'row', alignItems: 'center' },
  })

  const header = (
    <View style={localHeaderStyles.header}>
      <TouchableOpacity onPress={() => { try { router.back() } catch {} }} style={localHeaderStyles.leftBtn} accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
      </TouchableOpacity>
      <Text style={[localHeaderStyles.title, { marginLeft: -25 }]}>Verification Reviews</Text>
      <View style={localHeaderStyles.rightActions} />
    </View>
  )

  if (loading) return <LoadingSpinner message="Loading verifications..." />

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {header}
      <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 }}>
        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
          {['pending','flagged','approved','rejected'].map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatus(s)}
              style={status === s ? [pstyles.addBtn, { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, minWidth: 92 }] : { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }}
            >
              <Text style={status === s ? pstyles.addBtnText : { color: '#111827', fontWeight: '600', textTransform: 'capitalize' }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <FlatList
          data={groupedData}
          keyExtractor={(it, idx) => it.type === 'group' ? `g:${it.userId}:${status}` : `s:${it.item.id}`}
          renderItem={({ item }) => item.type === 'group' ? <GroupRow group={item} status={status} /> : <Row item={item.item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
    
    </View>
  )
}
