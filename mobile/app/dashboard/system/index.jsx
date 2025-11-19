import { View, Text, TouchableOpacity, FlatList } from 'react-native'
import { getJSON } from '../../../context/api'
import { useEffect, useState } from 'react'

export default function Overview() {
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('total') // 'total' or 'events'

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const overviewRes = await getJSON(`/api/analytics/overview`)
        if (alive) {
          setData(overviewRes)
        }
      } catch (_e) { /* ignore for now */ }
    })()
    return () => { alive = false }
  }, [])

  // Demo series shaped like the provided examples (fallbacks if backend doesn't include trends)
  // Chart removed; no width calculation needed

  // tooltip & clamp removed — this page is simplified for MVP
  // derived KPI values (listings removed from System overview)

  const headerContent = (
    <>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 }}>Overview</Text>

      {/* Overview card (users KPI) */}
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius:8, marginBottom:8 }}>
        <View style={{ alignItems:'flex-start' }}>
          <Text style={{ color:'#6b7280' }}>Total Users</Text>
          <Text style={{ fontSize:22, fontWeight:'800', color:'#111827', marginTop:6 }}>{Number(data?.totals?.total || 0).toLocaleString()}</Text>
        </View>
      </View>

      {/* Tab controls */}
      <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
        <TouchableOpacity onPress={() => setActiveTab('total')} style={{ paddingVertical:8, paddingHorizontal:14, borderRadius:999, backgroundColor: activeTab==='total' ? '#111827' : '#fff' }}>
          <Text style={{ color: activeTab==='total' ? '#fff' : '#111827', fontWeight:'700' }}>Total Users</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('events')} style={{ paddingVertical:8, paddingHorizontal:14, borderRadius:999, backgroundColor: activeTab==='events' ? '#111827' : '#fff' }}>
          <Text style={{ color: activeTab==='events' ? '#fff' : '#111827', fontWeight:'700' }}>Events</Text>
        </TouchableOpacity>
      </View>

      {/* Main content (chart shown in header for total tab) */}
      {/* Total Users graph removed as requested */}
    </>
  )

  const listData = activeTab === 'events' ? (data?.recentEvents || data?.events || []) : []

  return (
    <FlatList
      data={listData}
      keyExtractor={(item, idx) => String(idx)}
      ListHeaderComponent={headerContent}
      renderItem={({ item }) => (
        <View style={{ padding:12, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#f3f4f6' }}>
          <Text style={{ fontWeight:'700' }}>{item.type || item.title || 'Event'}</Text>
          <Text style={{ color:'#6b7280', marginTop:4 }}>{item.description || item.desc || item.message || ''}</Text>
          <Text style={{ color:'#9ca3af', marginTop:6, fontSize:12 }}>{item.time || item.created_at || item.d || ''}</Text>
        </View>
      )}
      ListEmptyComponent={activeTab === 'events' ? (
        <View style={{ padding:24, alignItems:'center' }}>
          <Text style={{ color:'#6b7280' }}>No events to show</Text>
        </View>
      ) : null}
      contentContainerStyle={{ padding:16, gap:12 }}
      style={{ flex:1, backgroundColor:'#f3f4f6' }}
    />
  )
}
