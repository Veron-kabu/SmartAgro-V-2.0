"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, SectionList, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { getJSON } from '../../context/api'
import { groupOrders, formatCurrency, formatDate, statusBadgeColor } from '../../utils/orders'
import { OrderTimeline } from '../../components/OrderTimeline'
import { buyerOrdersStyles as styles } from '../../assets/styles/orders.styles'

export default function BuyerOrders() {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 25

  const load = useCallback(async (nextOffset = 0) => {
    if (nextOffset === 0) setLoading(true)
    if (nextOffset > 0) setLoadingMore(true)
    try {
      const data = await getJSON(`/api/orders?buyer=me&limit=${limit}&offset=${nextOffset}`)
      const items = Array.isArray(data?.items) ? data.items : []
      setOrders(prev => nextOffset === 0 ? items : [...prev, ...items])
      setTotal(Number(data?.total || items.length || 0))
      setOffset(nextOffset)
    } catch (_e) {
      // fallback mock
      const mock = [
        { id: 1, status: 'pending', totalAmount: 120.5, createdAt: new Date().toISOString(), product: { title: 'Fresh Maize' }, farmer: { fullName: 'John Farmer' } },
        { id: 2, status: 'delivered', totalAmount: 89, createdAt: new Date(Date.now()-86400000).toISOString(), product: { title: 'Organic Beans' }, farmer: { fullName: 'Sarah Grower' } },
      ]
      setOrders(mock)
      setTotal(mock.length)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(0) }, [load])

  const { current, completed } = useMemo(() => groupOrders(orders), [orders])
  const canLoadMore = orders.length < total

  const sections = [
    { key: 'current', title: 'Current Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (current.length ? current : [{ __empty: true }]) },
    { key: 'completed', title: 'Completed Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (completed.length ? completed : [{ __empty: true }]) },
  ]

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => String(item?.id ?? index)}
      contentContainerStyle={{ paddingBottom: 24 }}
      style={styles.container}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(0) }}
      onEndReachedThreshold={0.3}
      onEndReached={() => { if (canLoadMore && !loadingMore) load(offset + limit) }}
      renderSectionHeader={({ section }) => (
        <View style={[styles.card, { paddingBottom: 8 }]}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {loading ? <ActivityIndicator size="small" color="#16a34a" /> : null}
          </View>
        </View>
      )}
      renderItem={({ item, section }) => {
        if (item.__skeleton) return (<View style={styles.card}><View style={styles.skelTitle} /><View style={styles.skelLine} /></View>)
        if (item.__empty) return (<View style={styles.card}><Text style={styles.muted}>No orders yet.</Text></View>)
        const badge = statusBadgeColor(item.status)
        return (
          <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => router.push(`/orders/order-details?id=${item.id}`)}>
            <View style={styles.rowBetween}>
              <Text style={styles.bold}>{item.product?.title || 'Product'}</Text>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeText, { color: badge.fg }]}>{String(item.status || '').toUpperCase()}</Text></View>
            </View>
            <Text style={styles.muted}>Farmer: {item.farmer?.fullName || 'Unknown'}</Text>
            <View style={[styles.rowBetween, { marginTop: 6 }]}>
              <Text style={styles.muted}>{formatDate(item.createdAt)}</Text>
              <Text style={styles.bold}>{formatCurrency(item.totalAmount)}</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <OrderTimeline status={item.status} compact />
            </View>
          </TouchableOpacity>
        )
      }}
      ListFooterComponent={canLoadMore ? (
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
          {loadingMore ? <ActivityIndicator size="small" color="#16a34a" /> : null}
        </View>
      ) : null}
      stickySectionHeadersEnabled={false}
    />
  )
}
