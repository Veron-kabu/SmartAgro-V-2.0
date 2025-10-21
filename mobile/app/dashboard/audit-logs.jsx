import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native'
import { getJSON } from '../../context/api'

export default function AuditLogs() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getJSON('/api/admin/audit-logs?limit=200')
      setItems(data?.items || [])
    } catch (e) { console.log('logs fetch failed', e?.message) }
    finally { setLoading(false) }
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchLogs()
    setRefreshing(false)
  }, [fetchLogs])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <FlatList
        data={items}
        keyExtractor={(it, idx) => String(it.id || idx)}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10 }}>
            <Text style={{ fontWeight: '700' }}>{item.action}</Text>
            <Text style={{ color: '#6b7280', fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()}</Text>
            {item.subjectType && <Text style={{ marginTop: 6, fontSize: 12 }}>Subject: {item.subjectType} · {item.subjectId || '—'}</Text>}
            {item.details && <Text style={{ marginTop: 6, fontSize: 12, color: '#111827' }}>{JSON.stringify(item.details)}</Text>}
          </View>
        )}
      />
    </View>
  )
}
