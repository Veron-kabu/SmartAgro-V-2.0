import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { getJSON } from '../../context/api'

// Simple in-memory cache (resets on app reload)
const earningsCache = { data: null, fetchedAt: 0 }
const STALE_MS = 60 * 1000 // 1 minute

export default function EarningsScreen() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  const fetchEarnings = useCallback(async (force=false) => {
    try {
      setError(null)
      const now = Date.now()
      if (!force && earningsCache.data && (now - earningsCache.fetchedAt) < STALE_MS) {
        setSummary(earningsCache.data)
        setLoading(false)
        return
      }
      const data = await getJSON('/api/earnings/farmer/summary')
      earningsCache.data = data
      earningsCache.fetchedAt = now
      setSummary(data)
    } catch (e) {
      setError(e?.message || 'Failed to load earnings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEarnings() }, [fetchEarnings])

  const formatCurrency = useCallback((v) => {
    const num = Number(v||0)
    return `${summary?.currency || 'KES'} ${num.toLocaleString('en-KE',{maximumFractionDigits:2})}`
  }, [summary?.currency])

  if (loading) return <View style={styles.center}><ActivityIndicator size="small"/><Text style={styles.muted}> Loading earnings...</Text></View>
  if (error) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchEarnings(true) }}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  )

  const listings = summary?.listings || []
  const trend = summary?.trend || []

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding:16, paddingBottom: 40 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Earnings Overview</Text>
        <TouchableOpacity onPress={() => fetchEarnings(true)} style={styles.refreshBtn}><Text style={styles.refreshText}>↻</Text></TouchableOpacity>
      </View>
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Total Revenue</Text><Text style={styles.metricValue}>{formatCurrency(summary?.totalRevenue)}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Delivered Orders</Text><Text style={styles.metricValue}>{summary?.deliveredOrders}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Active Orders</Text><Text style={styles.metricValue}>{summary?.activeOrders}</Text></View>
  <View style={styles.metricCard}><Text style={styles.metricLabel}>Listings (Active)</Text><Text style={styles.metricValue}>{summary?.activeListings ?? listings.filter(l=>l.status==='active').length}</Text></View>
      </View>

      <Text style={styles.sectionHeading}>7-Day Revenue Trend</Text>
      <View style={styles.chartRow}>
        {trend.map(day => {
          const max = Math.max(...trend.map(t=>t.revenue||0),1)
          const h = (day.revenue / max) * 100
          return (
            <View key={day.date} style={styles.barWrapper}>
              <View style={[styles.bar,{ height: 4 + h }]} />
              <Text style={styles.barLabel}>{day.date.slice(5)}</Text>
            </View>
          )
        })}
      </View>

      <Text style={styles.sectionHeading}>Listings Performance</Text>
      {listings
        .slice()
        .sort((a,b)=> (b.revenue||0)-(a.revenue||0))
        .map(l => (
          <View key={l.id} style={styles.listingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listingTitle}>{l.title}</Text>
              <Text style={styles.listingSub}>{l.delivered} delivered · {formatCurrency(l.revenue)} · Avg {formatCurrency(l.avgUnitPrice)}</Text>
              {l.lastOrderAt && <Text style={styles.lastOrder}>Last: {new Date(l.lastOrderAt).toLocaleDateString()}</Text>}
            </View>
            <View style={styles.qtyBlock}>
              <Text style={styles.qtyValue}>{l.deliveredQuantity || 0}</Text>
              <Text style={styles.qtyLabel}>Qty</Text>
            </View>
          </View>
        ))}
      <View style={{ height: 60 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f9fafb' },
  center: { flex:1, alignItems:'center', justifyContent:'center' },
  muted: { color:'#6b7280', marginTop:6 },
  error: { color:'#dc2626', fontWeight:'600', marginBottom:12 },
  retryBtn: { backgroundColor:'#111827', paddingHorizontal:16, paddingVertical:8, borderRadius:8 },
  retryText: { color:'#fff', fontWeight:'600' },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  title: { fontSize:18, fontWeight:'700', color:'#111827' },
  refreshBtn: { backgroundColor:'#fff', paddingHorizontal:12, paddingVertical:6, borderRadius:8 },
  refreshText: { fontSize:16, fontWeight:'700', color:'#374151' },
  metricsGrid: { flexDirection:'row', flexWrap:'wrap', gap:12, marginBottom:24 },
  metricCard: { width:'47%', backgroundColor:'#fff', padding:12, borderRadius:12, elevation:2 },
  metricLabel: { fontSize:11, fontWeight:'600', color:'#6b7280' },
  metricValue: { fontSize:14, fontWeight:'700', color:'#111827', marginTop:4 },
  sectionHeading: { fontSize:14, fontWeight:'700', color:'#374151', marginBottom:12 },
  chartRow: { flexDirection:'row', alignItems:'flex-end', justifyContent:'space-between', padding:12, backgroundColor:'#fff', borderRadius:12, marginBottom:24 },
  barWrapper: { alignItems:'center', flex:1 },
  bar: { width:14, backgroundColor:'#16a34a', borderTopLeftRadius:4, borderTopRightRadius:4, alignSelf:'center' },
  barLabel: { fontSize:9, color:'#6b7280', marginTop:4 },
  listingRow: { flexDirection:'row', backgroundColor:'#fff', padding:12, borderRadius:12, marginBottom:10, alignItems:'center' },
  listingTitle: { fontSize:13, fontWeight:'600', color:'#111827' },
  listingSub: { fontSize:11, color:'#6b7280', marginTop:2 },
  lastOrder: { fontSize:10, color:'#9ca3af', marginTop:2 },
  qtyBlock: { width:48, alignItems:'center', justifyContent:'center', backgroundColor:'#f3f4f6', paddingVertical:8, borderRadius:10, marginLeft:12 },
  qtyValue: { fontSize:14, fontWeight:'700', color:'#111827' },
  qtyLabel: { fontSize:10, color:'#6b7280' }
})
