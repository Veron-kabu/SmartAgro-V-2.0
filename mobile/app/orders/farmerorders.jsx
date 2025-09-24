"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { getJSON, patchJSON } from '../../context/api'
import { groupOrders, formatCurrency, formatDate, statusBadgeColor } from '../../utils/orders'

export default function FarmerOrders() {
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
      const data = await getJSON(`/api/orders?farmer=me&limit=${limit}&offset=${nextOffset}`)
      const items = Array.isArray(data?.items) ? data.items : []
      setOrders(prev => nextOffset === 0 ? items : [...prev, ...items])
      setTotal(Number(data?.total || items.length || 0))
      setOffset(nextOffset)
    } catch (_e) {
      // fallback mock
      const mock = [
        { id: 101, status: 'pending', totalAmount: 60, createdAt: new Date().toISOString(), product: { title: 'Tomatoes' }, buyer: { fullName: 'Buyer One' } },
        { id: 102, status: 'accepted', totalAmount: 200, createdAt: new Date().toISOString(), product: { title: 'Cabbage' }, buyer: { fullName: 'Buyer Two' } },
        { id: 103, status: 'delivered', totalAmount: 120, createdAt: new Date().toISOString(), product: { title: 'Onions' }, buyer: { fullName: 'Buyer Three' } },
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

  async function updateStatus(orderId, status) {
    try {
      await patchJSON(`/api/orders/${orderId}`, { status })
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not update order')
    }
  }

  const sections = [
    { key: 'current', title: 'Incoming Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (current.length ? current : [{ __empty: true }]) },
    { key: 'completed', title: 'Fulfilled Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (completed.length ? completed : [{ __empty: true }]) },
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
      renderItem={({ item }) => {
        if (item.__skeleton) return (<View style={styles.card}><View style={styles.skelTitle} /><View style={styles.skelLine} /></View>)
        if (item.__empty) return (<View style={styles.card}><Text style={styles.muted}>No orders yet.</Text></View>)
        const badge = statusBadgeColor(item.status)
        const actions = []
        const s = (item.status || '').toLowerCase()
        if (s === 'pending') actions.push({ label: 'Accept', next: 'accepted' }, { label: 'Reject', next: 'rejected' })
        if (s === 'accepted') actions.push({ label: 'Start', next: 'in_progress' })
        if (s === 'in_progress') actions.push({ label: 'Ship', next: 'shipped' })
        if (s === 'shipped') actions.push({ label: 'Complete', next: 'delivered' })

        return (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.bold}>{item.product?.title || 'Product'}</Text>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeText, { color: badge.fg }]}>{String(item.status || '').toUpperCase()}</Text></View>
            </View>
            <Text style={styles.muted}>Buyer: {item.buyer?.fullName || 'Unknown'}</Text>
            <View style={[styles.rowBetween, { marginTop: 6 }]}>
              <Text style={styles.muted}>{formatDate(item.createdAt)}</Text>
              <Text style={styles.bold}>{formatCurrency(item.totalAmount)}</Text>
            </View>
            {actions.length ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {actions.map(a => (
                  <TouchableOpacity key={a.label} style={styles.button} onPress={() => updateStatus(item.id, a.next)}>
                    <Text style={styles.buttonText}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  card: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  muted: { color: '#6b7280', fontSize: 12 },
  bold: { fontWeight: '700', color: '#111827' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  button: { backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  skelTitle: { height: 14, backgroundColor: '#e5e7eb', borderRadius: 6, width: '60%' },
  skelLine: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 6, width: '40%', marginTop: 8 },
})
