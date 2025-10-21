import { useEffect, useState, useCallback } from 'react'
import { View, Text, ActivityIndicator, ScrollView } from 'react-native'
import { getJSON } from '../../context/api'

export default function VerificationUpdates() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const latest = await getJSON('/api/verification/my-status')
      let details = null
      if (latest?.status && latest?.status !== 'unverified') {
        try { details = await getJSON('/api/verification/my-latest') } catch {}
      }
      setData({ latest, details })
    } catch (_e) {
      setData({ latest: { status: 'unverified' }, details: null })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>
  const status = data?.latest?.status || 'unverified'
  const rec = data?.details || {}
  const comments = (rec?.adminComments || []).filter(c => c.visibleToUser)
  const history = Array.isArray(rec?.history) ? rec.history : []
  const reviewerMessage = rec?.reviewerMessage || null

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Verification Updates</Text>
      <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontWeight: '700' }}>Current status</Text>
        <Text style={{ marginTop: 4 }}>{status}</Text>
      </View>
      <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontWeight: '700' }}>Reviewer comments</Text>
        {reviewerMessage && (
          <View style={{ marginTop: 8, backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B' }}>
            <Text style={{ color: '#92400E' }}>{reviewerMessage}</Text>
          </View>
        )}
        {comments.length === 0 ? (<Text style={{ marginTop: 4, color: '#6b7280' }}>No reviewer comments to show</Text>) : (
          comments.map((c, idx) => (
            <View key={idx} style={{ marginTop: 8, backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8 }}>
              <Text>{c.text}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{new Date(c.createdAt).toLocaleString()}</Text>
            </View>
          ))
        )}
      </View>
      {/* Per-image guidance removed */}
      <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontWeight: '700' }}>History</Text>
        {history.length === 0 ? (<Text style={{ marginTop: 4, color: '#6b7280' }}>No history yet</Text>) : (
          history.map((h, idx) => (
            <View key={idx} style={{ marginTop: 8 }}>
              <Text>{h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}</Text>
              {h.note ? <Text style={{ color: '#374151', marginTop: 2 }}>Note: {h.note}</Text> : null}
              <Text style={{ color: '#6b7280', fontSize: 12 }}>{new Date(h.createdAt).toLocaleString()}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}
