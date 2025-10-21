import React, { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native'
import BlurhashImage from '../../components/BlurhashImage'
import { getJSON } from '../../context/api'
import { formatCurrency, formatDate, statusBadgeColor } from '../../utils/orders'
import { orderDetailStyles as styles } from '../../assets/styles/orders.styles'
import { OrderTimeline } from '../../components/OrderTimeline'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'
import { COLORS } from '../../constants/colors'
import { useProfile } from '../../context/profile'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'

export default function OrderDetails() {
  const { id } = useLocalSearchParams()
  const numericId = Number(id)
  const { profile } = useProfile()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolvedImg] = useResolvedUrls(useMemo(() => order?.product?.imageUrl ? [order.product.imageUrl] : [], [order?.product?.imageUrl]))

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
  const canReview = String(order.status || '').toLowerCase() === 'delivered' && profile?.id && order?.buyer?.id === profile.id

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding:16, paddingBottom:40 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Order #{order.id}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeText, { color: badge.fg }]}>{String(order.status || '').toUpperCase()}</Text></View>
      </View>
      {String(order.status).toLowerCase() === 'paused' && (
        <View style={{ marginTop: 10, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 8, padding: 10 }}>
          <Text style={{ color: '#92400E', fontWeight: '700' }}>Order paused</Text>
          <Text style={{ color: '#92400E', marginTop: 4 }}>This order is paused due to account suspension. Progress will resume automatically after the account is reactivated.</Text>
        </View>
      )}
      <Text style={styles.muted}>Placed {formatDate(order.createdAt)}</Text>
      <View style={styles.section}>        
        <Text style={styles.sectionLabel}>Product</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 6 }}>
          <BlurhashImage
            uri={resolvedImg || order?.product?.imageUrl || undefined}
            blurhash={order?.product?.imageBlurhash || undefined}
            style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' }}
            contentFit="cover"
          />
          <Text style={styles.value}>{order.product?.title || 'Unknown'} ({formatCurrency(order.unitPrice)} / {order.product?.unit || 'unit'})</Text>
        </View>
        <Text style={styles.value}>Quantity: {order.quantity}</Text>
        <Text style={styles.value}>Total: {formatCurrency(order.totalAmount)}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Participants</Text>
        <Text style={styles.value}>Buyer: {order.buyer?.fullName || 'N/A'}</Text>
        <Text style={styles.value}>Farmer: {order.farmer?.fullName || 'N/A'}</Text>
      </View>
      {/* Actions */}
      <View style={[styles.section, { marginTop: 16 }]}>
        <Text style={styles.sectionLabel}>Actions</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <TouchableOpacity
            onPress={() => router.push(`/dashboard/user-profile?id=${order.farmer?.id}&productId=${order.product?.id}`)}
            style={{ backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Seller Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/report-user?id=${order.farmer?.id}`)}
            style={{ backgroundColor: '#dc2626', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Report Seller</Text>
          </TouchableOpacity>
          {canReview ? (
            <TouchableOpacity
              onPress={() => router.push(`/orders/write-review?id=${order.id}`)}
              style={{ backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Write a Review</Text>
            </TouchableOpacity>
          ) : null}
        </View>
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

