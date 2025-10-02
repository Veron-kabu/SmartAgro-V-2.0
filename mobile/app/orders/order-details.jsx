"use client";
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { getJSON } from '../../context/api'
import { formatCurrency, formatDate, statusBadgeColor } from '../../utils/orders'
import { OrderTimeline } from '../../components/OrderTimeline'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'

export default function OrderDetails() {
  const { id } = useLocalSearchParams()
  const numericId = Number(id)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!numericId) return
    let mounted = true
    ;(async () => {
      try {
        const data = await getJSON(`/api/orders/${numericId}`)
        if (mounted) {
          setOrder(data)
          track(ANALYTICS_EVENTS.ORDER_VIEWED, { orderId: numericId })
        }
      } catch (e) {
        setError(e?.message || 'Failed to load order')
      } finally { setLoading(false) }
    })()
    return () => { mounted = false }
  }, [numericId])

  if (!numericId || Number.isNaN(numericId)) return <View style={styles.center}><Text style={styles.error}>Invalid order id</Text></View>
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#16a34a" /></View>
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
  if (!order) return <View style={styles.center}><Text style={styles.error}>Order not found</Text></View>

  const badge = statusBadgeColor(order.status)

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding:16, paddingBottom:40 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Order #{order.id}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeText, { color: badge.fg }]}>{String(order.status || '').toUpperCase()}</Text></View>
      </View>
      <Text style={styles.muted}>Placed {formatDate(order.createdAt)}</Text>
      <View style={styles.section}>        
        <Text style={styles.sectionLabel}>Product</Text>
        <Text style={styles.value}>{order.product?.title || 'Unknown'} ({formatCurrency(order.unitPrice)} / {order.product?.unit || 'unit'})</Text>
        <Text style={styles.value}>Quantity: {order.quantity}</Text>
        <Text style={styles.value}>Total: {formatCurrency(order.totalAmount)}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Participants</Text>
        <Text style={styles.value}>Buyer: {order.buyer?.fullName || 'N/A'}</Text>
        <Text style={styles.value}>Farmer: {order.farmer?.fullName || 'N/A'}</Text>
      </View>
      {order.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text style={styles.value}>{order.notes}</Text>
        </View>
      ) : null }
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Timeline</Text>
        <OrderTimeline status={order.status} />
        <View style={{ marginTop: 12 }}>
          {order.history && order.history.length ? order.history.map(h => (
            <View key={h.id} style={styles.historyRow}>
              <Text style={styles.historyStatus}>{h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}</Text>
              <Text style={styles.historyTime}>{formatDate(h.createdAt)}</Text>
            </View>
          )) : <Text style={styles.muted}>No history.</Text>}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f9fafb' },
  center: { flex:1, justifyContent:'center', alignItems:'center', padding:16 },
  error: { color:'#dc2626' },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  title: { fontSize:20, fontWeight:'700', color:'#111827' },
  muted: { color:'#6b7280', fontSize:12 },
  badge: { borderRadius:999, paddingHorizontal:10, paddingVertical:4 },
  badgeText: { fontSize:10, fontWeight:'700' },
  section: { backgroundColor:'#fff', padding:12, borderRadius:10, marginTop:16 },
  sectionLabel: { fontSize:14, fontWeight:'700', color:'#111827', marginBottom:4 },
  value: { color:'#111827', fontSize:13, marginTop:2 },
  historyRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:6, borderBottomWidth:1, borderColor:'#f1f5f9' },
  historyStatus: { fontSize:12, fontWeight:'600', color:'#111827' },
  historyTime: { fontSize:11, color:'#64748b' },
})
