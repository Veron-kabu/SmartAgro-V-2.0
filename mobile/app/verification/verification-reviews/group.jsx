import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Image, Linking, Platform } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { getJSON } from '../../../context/api'
import { useResolvedUrls } from '../../../hooks/useResolvedUrls'

export default function VerificationGroupView() {
  const { userId, status, email } = useLocalSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', String(status))
      const data = await getJSON(`/api/admin/verifications?${params.toString()}`)
      const all = Array.isArray(data?.items) ? data.items : []
      const filtered = all.filter(it => String(it.userId) === String(userId))
      // newest first
      filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      setItems(filtered)
    } catch (_e) {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [userId, status])

  useEffect(() => { fetchData() }, [fetchData])

  const title = useMemo(() => {
    const base = email ? String(email) : `User #${userId}`
    const stat = status ? ` · ${String(status).toUpperCase()}` : ''
    return `${base}${stat}`
  }, [userId, email, status])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>

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
      <TouchableOpacity onPress={() => router.push({ pathname: '/verification/verification-reviews/[id]', params: { id: String(item.id) } })} style={{ backgroundColor: '#fff', marginBottom: 10, padding: 12, borderRadius: 12, marginHorizontal: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {resolvedThumb ? (
            <Image source={{ uri: resolvedThumb }} style={{ width: 56, height: 56, backgroundColor: '#e5e7eb', borderRadius: 8, marginRight: 12 }} />
          ) : (
            <View style={{ width: 56, height: 56, backgroundColor: '#e5e7eb', borderRadius: 8, marginRight: 12 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>#{item.id} · {item.userEmail || email || '—'}</Text>
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <View style={{ padding: 12, paddingTop: 16, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
          <Text style={{ color: '#2563eb' }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>{title}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={({ item }) => <Row item={item} />}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </View>
  )
}
