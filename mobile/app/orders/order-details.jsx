import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, ScrollView } from 'react-native'
import { getJSON } from '../../context/api'
import { formatCurrency, formatDate, statusBadgeColor } from '../../utils/orders'
import { orderDetailStyles as styles } from '../../assets/styles/orders.styles'
import { OrderTimeline } from '../../components/OrderTimeline'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'
import { COLORS } from '../../constants/colors'

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
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
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
