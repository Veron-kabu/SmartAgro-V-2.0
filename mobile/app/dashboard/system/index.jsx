import { View, Text, Dimensions, TouchableOpacity, FlatList } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
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
  const chartWidth = Math.max(320, Dimensions.get('window').width - 32)

  // tooltip & clamp removed — this page is simplified for MVP
  // derived KPI values (prefer totalListings if provided)
  const totalListingsVal = (data && (typeof data.totals?.totalListings !== 'undefined')) ? data.totals.totalListings : (data?.totals?.openListings ?? 0)

  const headerContent = (
    <>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 }}>Overview</Text>

      {/* Single overview card containing the three KPIs */}
      <View style={{ backgroundColor:'#fff', padding:16, borderRadius:8, marginBottom:8 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <View style={{ flex:1, alignItems:'flex-start' }}>
            <Text style={{ color:'#6b7280' }}>Total Users</Text>
            <Text style={{ fontSize:22, fontWeight:'800', color:'#111827', marginTop:6 }}>{Number(data?.totals?.total || 0).toLocaleString()}</Text>
          </View>
          <View style={{ flex:1, alignItems:'flex-end' }}>
            <Text style={{ color:'#6b7280' }}>Total Listings</Text>
            <Text style={{ fontSize:22, fontWeight:'800', color:'#111827', marginTop:6 }}>{Number(totalListingsVal || 0).toLocaleString()}</Text>
          </View>
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
      {activeTab === 'total' && (
        <View style={{ marginTop:12 }}>
          <View style={{ backgroundColor:'#fff', borderRadius:8, padding:16 }}>
            <Text style={{ fontSize:18, fontWeight:'700', marginBottom:12 }}>Total Users</Text>
            <View style={{ alignItems:'center' }}>
              <View style={{ width: chartWidth, position:'relative' }}>
                {(() => {
                  const demo = [10,30,55,70,90,115]
                  const raw = (data?.usersTrend || data?.users?.trend) ? (data?.usersTrend || data?.users?.trend).map(r => Number(r.c || r.count || r.value || 0)) : demo
                  const isNonDecreasing = raw.length <= 1 || raw.every((v, i, arr) => i === 0 || v >= arr[i-1])
                  const series = isNonDecreasing ? raw : raw.reduce((acc, cur, i) => (i === 0 ? [cur] : acc.concat(acc[i-1] + cur)), [])
                  const labels = (data?.usersTrend || data?.users?.trend) ? (data?.usersTrend || data?.users?.trend).map(r => { try { const d = new Date(r.d); return `${d.getMonth()+1}/${d.getDate()}` } catch { return '' } }) : ['Jan','Feb','Mar','Apr','May','Jun']
                  const chartData = series.map((v,i) => ({ value: v, label: labels[i] || '' }))
                  return (
                    <LineChart
                      data={chartData}
                      width={chartWidth}
                      height={260}
                      spacing={40}
                      initialSpacing={12}
                      color="#4f46e5"
                      areaChart
                      hideRules
                      hideDataPoints={false}
                      dataPointLabelPosition={'AUTO'}
                      curved
                      showVerticalLines={false}
                    />
                  )
                })()}
              </View>
            </View>
          </View>
        </View>
      )}
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
