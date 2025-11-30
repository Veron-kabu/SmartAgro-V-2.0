"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, SectionList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import BlurhashImage from '../../components/BlurhashImage'
import EmptyState from '../../components/EmptyState'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getJSON, patchJSON } from '../../context/api'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { groupOrders, formatCurrency, formatDate, statusBadgeColor, nextStatusesFor } from '../../utils/orders'
import { OrderTimeline } from '../../components/OrderTimeline'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'
import { farmerOrdersStyles as styles } from '../../assets/styles/orders.styles'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
import { useProfile } from '../../context/profile'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function FarmerOrders() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { profile } = useProfile()
  const isFarmer = String(profile?.role || '').toLowerCase() === 'farmer'
  // Maintain separate lists for sent (as seller) and received/bought (as buyer)
  const [ordersSent, setOrdersSent] = useState([])
  const [ordersReceived, setOrdersReceived] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [totalSent, setTotalSent] = useState(0)
  const [totalReceived, setTotalReceived] = useState(0)
  const [offsetSent, setOffsetSent] = useState(0)
  const [offsetReceived, setOffsetReceived] = useState(0)
  const [filterMode, setFilterMode] = useState('sent') // 'sent' | 'received'
  // Track 403 to show a friendlier message if needed (currently guarded by role)
  // const [error, setError] = useState(null)
  const limit = 25
  // Resolve product images for orders list
  const activeOrders = filterMode === 'sent' ? ordersSent : ordersReceived
  const productImageUrls = useMemo(() => (activeOrders || []).map(o => o?.product?.imageUrl || null).filter(Boolean), [activeOrders])
  const resolvedOrderImages = useResolvedUrls(productImageUrls)
  const resolvedImageMap = useMemo(() => {
    const map = new Map()
    let idx = 0
    for (const o of (activeOrders || [])) {
      const raw = o?.product?.imageUrl || null
      if (raw) {
        const r = resolvedOrderImages[idx]
        map.set(raw, r || raw)
        idx++
      }
    }
    return map
  }, [activeOrders, resolvedOrderImages])

  const mergeUnique = (prev = [], items = []) => {
    const map = new Map()
    for (const o of prev) { if (o && o.id != null) map.set(o.id, o) }
    for (const o of items) { if (o && o.id != null) map.set(o.id, o) }
    const arr = Array.from(map.values())
    arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    return arr
  }

  const load = useCallback(async (nextOffsetSent = 0, nextOffsetReceived = 0, mode = 'both') => {
    if (!isFarmer) { setLoading(false); return }
    if (nextOffsetSent === 0 && nextOffsetReceived === 0) setLoading(true)
    if (nextOffsetSent > 0 || nextOffsetReceived > 0) setLoadingMore(true)
    try {
      const tasks = []
      if (mode === 'both' || mode === 'sent') {
        tasks.push(getJSON(`/api/orders?farmer=me&limit=${limit}&offset=${nextOffsetSent}`).then(data => ({ kind: 'sent', data })))
      }
      if (mode === 'both' || mode === 'received') {
        tasks.push(getJSON(`/api/orders?buyer=me&limit=${limit}&offset=${nextOffsetReceived}`).then(data => ({ kind: 'received', data })))
      }
      const results = await Promise.all(tasks)
      for (const r of results) {
        const items = Array.isArray(r.data?.items) ? r.data.items : []
        if (r.kind === 'sent') {
          setOrdersSent(prev => nextOffsetSent === 0 ? mergeUnique([], items) : mergeUnique(prev, items))
          setTotalSent(Number(r.data?.total || items.length || 0))
          setOffsetSent(nextOffsetSent)
        } else {
          setOrdersReceived(prev => nextOffsetReceived === 0 ? mergeUnique([], items) : mergeUnique(prev, items))
          setTotalReceived(Number(r.data?.total || items.length || 0))
          setOffsetReceived(nextOffsetReceived)
        }
      }
    } catch (_e) {
      // Fallback mocks (kept minimal)
      if (nextOffsetSent === 0) {
        const mockS = [ { id: 103, status: 'delivered', totalAmount: 120, createdAt: new Date().toISOString(), product: { title: 'Onions' }, buyer: { fullName: 'Buyer Three' } } ]
        setOrdersSent(mockS)
        setTotalSent(mockS.length)
      }
      if (nextOffsetReceived === 0) {
        const mockR = [ { id: 203, status: 'delivered', totalAmount: 50, createdAt: new Date().toISOString(), product: { title: 'Spinach' }, farmer: { fullName: 'Other Farmer' } } ]
        setOrdersReceived(mockR)
        setTotalReceived(mockR.length)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [isFarmer])

  useEffect(() => { load(0, 0, 'both') }, [load])

  // interval forces re-render to show delayed syncing label without storing tick
  useEffect(() => {
    const id = setInterval(() => {
      // lightweight nudge: clone active list to trigger re-render
      if (filterMode === 'sent') setOrdersSent(prev => prev.map(o => o))
      else setOrdersReceived(prev => prev.map(o => o))
    }, 1000)
    return () => clearInterval(id)
  }, [filterMode])

  const { current: currentSent, completed: completedSent } = useMemo(() => groupOrders(ordersSent), [ordersSent])
  const { current: currentReceived, completed: completedReceived } = useMemo(() => groupOrders(ordersReceived), [ordersReceived])
  // Which "view" should we show? defaults to 'fulfilled' to match previous behavior
  const view = String(params?.view || '').toLowerCase()
  const showingIncoming = view === 'incoming' || view === 'current'
  // If we're on Incoming view, force Sent mode and hide the toggle
  useEffect(() => {
    if (showingIncoming && filterMode !== 'sent') setFilterMode('sent')
  }, [showingIncoming, filterMode])
  const listData = useMemo(() => {
    if (filterMode === 'sent') return showingIncoming ? currentSent : completedSent
    return showingIncoming ? currentReceived : completedReceived
  }, [filterMode, showingIncoming, currentSent, completedSent, currentReceived, completedReceived])
  // Pagination guard: compare offsets against totals to avoid a stuck footer spinner
  const canLoadMore = showingIncoming
    ? ((offsetSent + limit) < totalSent)
    : ((filterMode === 'sent') ? ((offsetSent + limit) < totalSent) : ((offsetReceived + limit) < totalReceived))

  async function updateStatus(orderId, status) {
    const now = Date.now()
    setOrdersSent(prev => prev.map(o => o.id === orderId ? { ...o, status, __optimistic: true, __optimisticAt: now, __prevStatus: o.status } : o))
    setOrdersReceived(prev => prev.map(o => o.id === orderId ? { ...o, status, __optimistic: true, __optimisticAt: now, __prevStatus: o.status } : o))
    try {
      await patchJSON(`/api/orders/${orderId}/status`, { status })
      setOrdersSent(prev => prev.map(o => o.id === orderId ? { ...o, __optimistic: false, __prevStatus: undefined, __optimisticAt: undefined } : o))
      setOrdersReceived(prev => prev.map(o => o.id === orderId ? { ...o, __optimistic: false, __prevStatus: undefined, __optimisticAt: undefined } : o))
  track(ANALYTICS_EVENTS.ORDER_STATUS_UPDATED, { orderId, status })
    } catch (e) {
      // rollback
      setOrdersSent(prev => prev.map(o => o.id === orderId ? { ...o, status: o.__prevStatus || o.status, __optimistic: false, __prevStatus: undefined, __optimisticAt: undefined } : o))
      setOrdersReceived(prev => prev.map(o => o.id === orderId ? { ...o, status: o.__prevStatus || o.status, __optimistic: false, __prevStatus: undefined, __optimisticAt: undefined } : o))
      Alert.alert('Failed', e?.message || 'Could not update order')
  track(ANALYTICS_EVENTS.ORDER_STATUS_UPDATE_FAILED, { orderId, attempted: status })
    }
  }

  const sections = [
    { key: showingIncoming ? 'incoming' : 'completed', title: showingIncoming ? 'Incoming Orders' : 'Fulfilled Orders', data: (listData.length ? listData : [{ __empty: true }]) },
  ]

  if (!profile) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <ActivityIndicator size="small" color="#16a34a" />
      </View>
    )
  }

  if (!isFarmer) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 16 }]}> 
        <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16, textAlign: 'center' }}>Farmer orders are only available for Farmer accounts.</Text>
        <Text style={{ color: '#6b7280', marginTop: 8, textAlign: 'center' }}>Switch your role to Farmer from your profile to view incoming and fulfilled orders.</Text>
      </View>
    )
  }

  if (loading && ordersSent.length === 0 && ordersReceived.length === 0) {
    return <LoadingSpinner message="Loading orders..." />
  }

  return (
    <>
      <View style={{ paddingHorizontal: 16, paddingTop: 1, paddingBottom: 8, backgroundColor: COLORS.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 44, justifyContent: 'center', paddingLeft: 6 }} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: COLORS.text }}>{showingIncoming ? 'Incoming Orders' : 'Fulfilled Orders'}</Text>
          <View style={{ width: 44 }} />
        </View>
        {!showingIncoming && (
          <View style={{ flexDirection: 'row', marginTop: 8, justifyContent: 'center' }}>
            <TouchableOpacity onPress={() => setFilterMode('sent')} activeOpacity={0.85} style={[styles.button, { flex: 1, marginRight: 6, paddingVertical: 8, borderWidth: filterMode==='sent'?0:1, backgroundColor: filterMode==='sent'?'#16a34a':'transparent', borderColor: '#16a34a', alignItems: 'center', justifyContent: 'center', borderRadius: 999 }]}>
              <Text style={[styles.buttonText, { color: filterMode==='sent'?'#fff':'#16a34a' }]}>i Sold</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFilterMode('received')} activeOpacity={0.85} style={[styles.button, { flex: 1, marginLeft: 6, paddingVertical: 8, borderWidth: filterMode==='received'?0:1, backgroundColor: filterMode==='received'?'#16a34a':'transparent', borderColor: '#16a34a', alignItems: 'center', justifyContent: 'center', borderRadius: 999 }]}>
              <Text style={[styles.buttonText, { color: filterMode==='received'?'#fff':'#16a34a' }]}>i Bought</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <SectionList
      sections={sections}
      keyExtractor={(item, index) => String(item?.id ?? index)}
      contentContainerStyle={{ paddingBottom: 24 }}
      style={styles.container}
      refreshing={refreshing}
  onRefresh={() => { setRefreshing(true); load(0, 0, 'both') }}
      onEndReachedThreshold={0.3}
      onEndReached={() => { if (canLoadMore && !loadingMore) {
        if (showingIncoming || filterMode === 'sent') load(offsetSent + limit, offsetReceived, 'sent')
        else load(offsetSent, offsetReceived + limit, 'received')
      } }}
      renderSectionHeader={() => null}
      renderItem={({ item }) => {
        if (item.__empty) return (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <EmptyState context="fulfilledOrders" />
          </View>
        )
        const badge = statusBadgeColor(item.status)
  // Actions (farmer/owner view): allow Ship only; do NOT allow owner to mark delivered.
  const nexts = nextStatusesFor(item.status, item.paymentStatus).filter(ns => ns !== 'delivered')
  const labelMap = { shipped: 'Ship' }
  const actions = nexts.map(ns => ({ label: labelMap[ns] || ns, next: ns }))

        return (
          <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => router.push(`/orders/order-details?id=${item.id}`)}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <BlurhashImage
                uri={(item?.product?.imageUrl && resolvedImageMap.get(item.product.imageUrl)) || item?.product?.imageUrl || undefined}
                blurhash={item?.product?.imageBlurhash || undefined}
                style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' }}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.bold} numberOfLines={1}>{item.product?.title || 'Product'}</Text>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                    <View style={[styles.badge, item.__optimistic && styles.badgePending, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>{String(item.status || '').toUpperCase()}</Text>
                    </View>
                    {item.__optimistic && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ActivityIndicator size="small" color="#16a34a" />
                        {item.__optimisticAt && Date.now() - item.__optimisticAt > 2000 && (
                          <Text style={styles.syncingText}>Syncing...</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.muted, { marginTop: 2 }]} numberOfLines={1}>Buyer: {item.buyer?.fullName || 'Unknown'}</Text>
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                  <Text style={styles.muted}>{formatDate(item.createdAt)}</Text>
                  <Text style={styles.bold}>{formatCurrency(item.totalAmount)}</Text>
                </View>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <OrderTimeline status={item.status} compact />
            </View>
            {String(item.status).toLowerCase() === 'paused' && (
              <View style={{ marginTop: 10, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 8, padding: 10 }}>
                <Text style={{ color: '#92400E', fontWeight: '600' }}>Order paused</Text>
                <Text style={{ color: '#92400E', marginTop: 4 }}>This order is paused due to account suspension. It will resume automatically once the account is reactivated.</Text>
              </View>
            )}
            {actions.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                {actions.map(a => (
                  <TouchableOpacity key={a.label} style={[styles.button, { marginRight: 8, marginBottom: 8 }, item.__optimistic && { opacity: 0.6 }]} disabled={item.__optimistic} onPress={() => updateStatus(item.id, a.next)}>
                    <Text style={styles.buttonText}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
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
    </>
  )
}
