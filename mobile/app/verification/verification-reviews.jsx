import { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, TextInput, Image, Linking, Platform } from 'react-native'
import { getJSON } from '../../context/api'
import { on as onEvent } from '../../utils/eventBus'
import { router } from 'expo-router'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'

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
  <TouchableOpacity onPress={() => router.push({ pathname: '/verification/verification-reviews/[id]', params: { id: String(item.id) } })} style={{ backgroundColor: '#fff', marginBottom: 10, padding: 12, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {resolvedThumb ? (
          <Image source={{ uri: resolvedThumb }} style={{ width: 56, height: 56, backgroundColor: '#e5e7eb', borderRadius: 8, marginRight: 12 }} />
        ) : (
          <View style={{ width: 56, height: 56, backgroundColor: '#e5e7eb', borderRadius: 8, marginRight: 12 }} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>#{item.id} · {item.userEmail || '—'}</Text>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: statusColor }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>{item.status}</Text>
        </View>
      </View>
      {item.awaitingSecondApproval && (
        <View style={{ marginTop: 8, backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8 }}>
          <Text style={{ color: '#92400E', fontSize: 12 }}>Awaiting second approval{item.firstReviewerId ? ` · first by #${item.firstReviewerId}` : ''}</Text>
        </View>
      )}
      <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
        {lat != null && lng != null ? (
          <TouchableOpacity onPress={openMap} style={{ backgroundColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ fontSize: 12, color: '#111827' }}>Map</Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
    <TouchableOpacity onPress={() => router.push({ pathname: '/verification/verification-reviews/group', params: { userId: String(group.userId), status, email: group.userEmail || '' } })} style={{ backgroundColor: '#fff', marginBottom: 10, padding: 12, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {resolvedThumb ? (
          <Image source={{ uri: resolvedThumb }} style={{ width: 56, height: 56, backgroundColor: '#e5e7eb', borderRadius: 8, marginRight: 12 }} />
        ) : (
          <View style={{ width: 56, height: 56, backgroundColor: '#e5e7eb', borderRadius: 8, marginRight: 12 }} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>{group.userEmail || '—'}</Text>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>{count} submissions · latest {new Date(group.latestCreatedAt).toLocaleString()}</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: statusColor }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>{status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function VerificationReviewsList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (since && since.trim()) params.set('since', since.trim())
      if (until && until.trim()) params.set('until', until.trim())
      const qs = params.toString()
      const data = await getJSON(`/api/admin/verifications${qs ? `?${qs}` : ''}`)
      setItems(data?.items || [])
    } catch (e) {
      console.log('fetch verifs failed', e?.message)
    } finally {
      setLoading(false)
    }
  }, [status, since, until])

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter(it => String(it.id).includes(term) || (it.userEmail || '').toLowerCase().includes(term))
  }, [items, q])

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

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <View style={{ padding: 12, paddingTop: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>Verification Reviews</Text>
        <FlatList
          data={[ 'pending', 'flagged', 'approved', 'rejected' ]}
          keyExtractor={(s) => s}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              onPress={() => setStatus(s)}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: status===s?'#111827':'#e5e7eb', marginRight: 8 }}
            >
              <Text style={{ color: status===s?'#fff':'#111827', textTransform: 'capitalize' }}>{s}</Text>
            </TouchableOpacity>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          contentContainerStyle={{ paddingRight: 8 }}
        />
        <View style={{ marginTop: 10, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
          <TextInput placeholder="Search by ID or email" value={q} onChangeText={setQ} />
        </View>
        <View style={{ marginTop: 8, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 8 }}>
          <TextInput placeholder="Since (ISO)" value={since} onChangeText={setSince} style={{ flex: 1 }} />
          <TextInput placeholder="Until (ISO)" value={until} onChangeText={setUntil} style={{ flex: 1 }} />
        </View>
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={groupedData}
          keyExtractor={(it, idx) => it.type === 'group' ? `g:${it.userId}:${status}` : `s:${it.item.id}`}
          renderItem={({ item }) => item.type === 'group' ? <GroupRow group={item} status={status} /> : <Row item={item.item} />}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  )
}
