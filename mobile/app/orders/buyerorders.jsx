import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { View, Text, SectionList, ActivityIndicator, TouchableOpacity } from 'react-native'
import EmptyState from '../../components/EmptyState'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getJSON, postJSON } from '../../context/api'
import { groupOrders, formatCurrency, formatDate, statusBadgeColor } from '../../utils/orders'
import { OrderTimeline } from '../../components/OrderTimeline'
import { buyerOrdersStyles as styles } from '../../assets/styles/orders.styles'
import { COLORS } from '../../constants/colors'

export default function BuyerOrders() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 25
  const listRef = useRef(null)
  const [focusedKey, setFocusedKey] = useState(null)

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
  const view = String(params?.view || '').toLowerCase() || (params?.focus ? String(params.focus).toLowerCase() : '')
  const canLoadMore = orders.length < total

  const sections = useMemo(() => {
    // Decide which single view to show
    if (view === 'current') {
      return [{ key: 'current', title: 'Current Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (current.length ? current : [{ __empty: true }]) }]
    }
    if (view === 'fulfilled' || view === 'completed') {
      return [{ key: 'completed', title: 'Fulfilled Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (completed.length ? completed : [{ __empty: true }]) }]
    }
    if (view === 'sent') {
      // Sent orders are equivalent to buyer orders overall; show all current+fulfilled together under a single heading
      const all = [...current, ...completed]
      return [{ key: 'sent', title: 'Sent Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (all.length ? all : [{ __empty: true }]) }]
    }
    // Default: show both as before
    return [
      { key: 'current', title: 'Current Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (current.length ? current : [{ __empty: true }]) },
    { key: 'completed', title: 'Fulfilled Orders', data: loading && orders.length === 0 ? [{ __skeleton: true }, { __skeleton: true }] : (completed.length ? completed : [{ __empty: true }]) },
    ]
  }, [view, loading, orders.length, current, completed])

  // Auto-scroll to section based on focus/view param and briefly highlight header
  useEffect(() => {
    const raw = String(params?.focus || params?.view || '').toLowerCase()
    if (!raw || !listRef.current || loading) return
    const key = raw === 'fulfilled' ? 'completed' : raw
    const index = sections.findIndex(s => s.key === key)
    if (index >= 0) {
      setTimeout(() => {
        try {
          listRef.current.scrollToLocation({ sectionIndex: index, itemIndex: 0, animated: true, viewPosition: 0 })
          setFocusedKey(key)
          setTimeout(() => setFocusedKey(null), 1600)
        } catch {}
      }, 0)
    }
  }, [params?.focus, params?.view, loading, sections])

  return (
    <SectionList
      ref={listRef}
      sections={sections}
      keyExtractor={(item, index) => String(item?.id ?? index)}
      contentContainerStyle={{ paddingBottom: 24 }}
      style={styles.container}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(0) }}
      onEndReachedThreshold={0.3}
      onEndReached={() => { if (canLoadMore && !loadingMore) load(offset + limit) }}
      renderSectionHeader={({ section }) => (
        <View style={[styles.card, { paddingBottom: 8 }, focusedKey === section.key && styles.sectionHeaderFocused]}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
          </View>
        </View>
      )}
      renderItem={({ item, section }) => {
        if (item.__skeleton) return (<View style={styles.card}><View style={styles.skelTitle} /><View style={styles.skelLine} /></View>)
        if (item.__empty) return (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <EmptyState context="orders" />
          </View>
        )
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
            {String(item.status).toLowerCase() === 'pending' && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await postJSON(`/api/orders/${item.id}/cancel`, {})
                      // Update local list optimistically
                      setOrders(prev => prev.map(o => o.id === item.id ? { ...o, status: 'cancelled' } : o))
                    } catch (_e) {
                      // Optionally surface error via toast/alert
                    }
                  }}
                  activeOpacity={0.85}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444' }}
                >
                  <Text style={{ color: '#ef4444', fontWeight: '600' }}>Cancel Order</Text>
                </TouchableOpacity>
              </View>
            )}
            {String(item.status).toLowerCase() === 'shipped' && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await postJSON(`/api/orders/${item.id}/mark-delivered`, {})
                      setOrders(prev => prev.map(o => o.id === item.id ? { ...o, status: 'delivered' } : o))
                    } catch (_e) {
                      // If fails, we can alert or ignore silently
                    }
                  }}
                  activeOpacity={0.85}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#16a34a' }}
                >
                  <Text style={{ color: '#16a34a', fontWeight: '700' }}>Mark Delivered</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        )
      }}
      ListFooterComponent={canLoadMore ? (
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
          {loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
        </View>
      ) : null}
      stickySectionHeadersEnabled={false}
    />
  )
}
