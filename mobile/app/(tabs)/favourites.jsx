import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Animated, PanResponder } from 'react-native'
import Shimmer from '../../components/Shimmer'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getJSON } from '../../context/api'
import { subscribeAppEvents } from '../../context/favorites'
import { useProfile } from '../../context/profile'
import { useCart } from '../../context/cart'
import { router } from 'expo-router'

export default function FavouritesScreen() {
  const { profile } = useProfile()
  const { items: cartItems, updateQuantity, removeItem, clearCart, getTotalPrice, addItem } = useCart()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showCart, setShowCart] = useState(true)
  const [undoData, setUndoData] = useState(null) // { item, timeout }
  const undoTimeoutRef = useRef(null)
  const SWIPE_THRESHOLD = 50
  const gestureRefs = useRef({})

  // Persist collapsed state
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('fav:cartCollapsed')
        if (saved === '0' || saved === '1') setShowCart(saved === '1')
      } catch {}
    })()
  }, [])
  const toggleCart = useCallback(() => {
    setShowCart(prev => {
      const next = !prev
      AsyncStorage.setItem('fav:cartCollapsed', next ? '1':'0').catch(()=>{})
      return next
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getJSON('/api/favorites')
      if (Array.isArray(data)) setItems(data)
      else setItems([])
    } catch (e) {
      setError(e?.message || 'Failed to load favourites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (profile?.id) load() }, [load, profile?.id])

  // Real-time subscription to app events for favorites & product deletions
  useEffect(() => {
    const hydrateCache = new Map()
    let mounted = true
    async function hydrateProduct(productId) {
      if (hydrateCache.has(productId)) return hydrateCache.get(productId)
      const p = (async () => {
        try {
          const data = await getJSON(`/api/products/${productId}`)
          if (!mounted) return null
          setItems(prev => prev.map(it => it.product?.id === productId ? {
            ...it,
            product: {
              id: data.id,
              title: data.title,
              price: data.price,
              unit: data.unit,
              images: data.images,
              location: data.location,
              farmerId: data.farmerId
            }
          } : it))
  } catch (_e) {
          // 404 -> mark deleted
          setItems(prev => prev.map(it => it.product?.id === productId ? { ...it, productDeleted: true, product: { id: productId, deleted: true } } : it))
        }
      })()
      hydrateCache.set(productId, p)
      return p
    }
    const unsub = subscribeAppEvents(evt => {
      if (!mounted) return
      if (evt.type === 'favorite:changed') {
        const { productId, favorited } = evt.payload || {}
        if (!productId) return
        setItems(prev => {
          const exists = prev.some(f => f.product?.id === productId)
            if (favorited) {
              if (exists) return prev
              // Add skeletal entry first
              const entry = { id: `tmp-${productId}-${Date.now()}`, createdAt: new Date().toISOString(), product: { id: productId }, farmer: null, __hydrating: true }
              // Hydrate asynchronously
              hydrateProduct(productId)
              return [entry, ...prev]
            } else {
              if (!exists) return prev
              return prev.filter(f => f.product?.id !== productId)
            }
        })
      } else if (evt.type === 'product:deleted') {
        const { productId } = evt.payload || {}
        if (!productId) return
        setItems(prev => prev.filter(f => f.product?.id !== productId))
      } else if (evt.type === 'product:stockChanged') {
        const { productId, remaining, status } = evt.payload || {}
        if (!productId) return
        setItems(prev => prev.map(f => f.product?.id === productId ? { ...f, product: { ...f.product, quantityAvailable: remaining, status: status || f.product?.status } } : f))
      }
    })
    return () => { mounted = false; unsub && unsub() }
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  // All authenticated users can see favorites list now (backend prevents self-favorite)

  if (loading) return <View style={styles.center}><Text>Loading…</Text></View>
  if (error) return <View style={styles.center}><Text style={{ color: 'crimson' }}>{error}</Text></View>

  const listHeader = (
    <View>
      {/* Cart Section */}
      {cartItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <TouchableOpacity style={styles.sectionTitleBtn} onPress={toggleCart} activeOpacity={0.7}>
              <Text style={styles.chevron}>{showCart ? '▾' : '▸'}</Text>
              <Text style={styles.sectionTitle}>In Cart ({cartItems.length})</Text>
            </TouchableOpacity>
            <View style={styles.sectionActions}>
              <TouchableOpacity onPress={clearCart} activeOpacity={0.7}><Text style={styles.clearText}>Clear</Text></TouchableOpacity>
            </View>
          </View>
          {showCart && (
            <View style={styles.cartList}>
              {cartItems.map(ci => {
                if (!gestureRefs.current[ci.id]) {
                  gestureRefs.current[ci.id] = { translateX: new Animated.Value(0) }
                }
                const ref = gestureRefs.current[ci.id]
                const panResponder = PanResponder.create({
                  onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 12,
                  onPanResponderMove: (_, g) => {
                    if (g.dx < 0) ref.translateX.setValue(Math.max(g.dx, -120))
                  },
                  onPanResponderRelease: (_, g) => {
                    if (g.dx < -SWIPE_THRESHOLD) {
                      Animated.timing(ref.translateX, { toValue: -120, duration: 160, useNativeDriver: true }).start()
                    } else {
                      Animated.spring(ref.translateX, { toValue: 0, useNativeDriver: true }).start()
                    }
                  }
                })
                const performDelete = () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{})
                  // store item for undo
                  const original = { ...ci }
                  removeItem(ci.id)
                  if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
                  undoTimeoutRef.current = setTimeout(() => {
                    setUndoData(null)
                  }, 5000)
                  setUndoData({ item: original })
                }
                return (
                  <View key={ci.id} style={{ overflow:'hidden' }}>
                    <View style={styles.swipeDeleteLayer}>
                      <TouchableOpacity style={styles.deleteBtn} onPress={performDelete}>
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                    <Animated.View style={[styles.cartRow, { transform:[{ translateX: ref.translateX }] }]} {...panResponder.panHandlers}>
                  <Image source={{ uri: ci.images?.[0] || ci.imageUrl || 'https://via.placeholder.com/44' }} style={styles.cartThumb} />
                  <View style={{ flex:1, marginLeft:10 }}>
                    <Text style={styles.cartName} numberOfLines={1}>{ci.title}</Text>
                    <Text style={styles.cartMeta}>KSH {ci.price} / {ci.unit}</Text>
                    <Text style={styles.cartMeta}>Subtotal: KSH {(ci.price * ci.quantity).toFixed(2)}</Text>
                  </View>
                  <View style={styles.qtyCol}>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(ci.id, ci.quantity - 1)}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                      <Text style={styles.qtyValue}>{ci.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(ci.id, ci.quantity + 1)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={performDelete}><Text style={styles.removeLink}>Remove</Text></TouchableOpacity>
                  </View>
                    </Animated.View>
                  </View>
                )
              })}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>KSH {getTotalPrice().toFixed(2)}</Text>
              </View>
              <TouchableOpacity style={styles.checkoutBtn} activeOpacity={0.85} onPress={() => router.push('/checkout')}>
                <Text style={styles.checkoutText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: cartItems.length>0 ? 8 : 0 }}>
        <Text style={styles.title}>Favourites</Text>
        {items.some(f=>f.productDeleted || f.product?.deleted) && (
          <TouchableOpacity onPress={() => setItems(prev => prev.filter(f => !(f.productDeleted || f.product?.deleted)))}>
            <Text style={{ color:'#ef4444', fontSize:12, fontWeight:'600' }}>Clear removed</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id || `${item.product?.id}-${item.farmer?.id}`)}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />}
        renderItem={({ item }) => {
          const deleted = item.productDeleted || item.product?.deleted
          const qty = item.product?.quantityAvailable
          const status = item.product?.status
          const out = !deleted && (status !== 'active' || qty === 0)
          const onPress = () => {
            if (!deleted && item.product?.id) {
              router.push(`/products/${item.product.id}`)
            }
          }
          // Skeleton while hydrating (newly added favorite awaiting product fetch)
          if (!deleted && item.__hydrating) {
            return (
              <View style={[styles.row, styles.skelRow]}>
                <Shimmer style={styles.skelThumb} />
                <View style={{ flex:1, marginLeft:12 }}>
                  <Shimmer style={styles.skelLineLg} />
                  <Shimmer style={styles.skelLineSm} />
                  <View style={{ flexDirection:'row', marginTop:6, gap:6 }}>
                    <Shimmer style={styles.skelPillWide} />
                    <Shimmer style={styles.skelPill} />
                  </View>
                </View>
              </View>
            )
          }
          return (
            <TouchableOpacity onPress={onPress} disabled={deleted} activeOpacity={0.8} style={[styles.row, deleted && { opacity:0.55 }]}>
              <Image source={{ uri: (!deleted && (item.product?.images?.[0])) || 'https://via.placeholder.com/48' }} style={[styles.thumb, deleted && { tintColor:'#9ca3af' }]} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.name, deleted && { textDecorationLine:'line-through', color:'#6b7280' }]} numberOfLines={1}>
                  {deleted ? 'Listing removed' : (item.product?.title || '')}
                </Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {deleted ? 'No longer available' : `Farmer: ${item.farmer?.fullName || ''}`}
                </Text>
                {!deleted && (
                  <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:2 }}>
                    <Text style={styles.metaText}>KSH {item.product?.price}/{item.product?.unit}</Text>
                    {typeof qty === 'number' && <Text style={[styles.metaDot]}> • </Text>}
                    {typeof qty === 'number' && <Text style={[styles.metaText, out && { color:'#dc2626' }]}>{qty} available</Text>}
                    {out && <Text style={[styles.badgeMini, { backgroundColor:'#dc2626' }]}>OUT</Text>}
                    {item.product?.discountPercent > 0 && <Text style={[styles.badgeMini, { backgroundColor:'#16a34a' }]}>-{item.product.discountPercent}%</Text>}
                    {item.product?.isOrganic && <Text style={[styles.badgeMini, { backgroundColor:'#065f46' }]}>ORG</Text>}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )
        }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={<Text style={styles.muted}>{cartItems.length>0 ? 'No favourites yet.' : 'No favourites yet.'}</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
      {/* Undo Snackbar */}
      {undoData && (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>Removed {undoData.item.title}</Text>
          <TouchableOpacity
            onPress={() => {
              if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
              addItem(undoData.item, undoData.item.quantity)
              Haptics.selectionAsync().catch(()=>{})
              setUndoData(null)
            }}
          >
            <Text style={styles.undoAction}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#e5e7eb' },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  muted: { color: '#6b7280', fontSize: 12 },
  metaText: { color:'#475569', fontSize:11, fontWeight:'600' },
  metaDot: { color:'#94a3b8', fontSize:11 },
  badgeMini: { marginLeft:6, paddingHorizontal:6, paddingVertical:2, borderRadius:8, color:'#fff', fontSize:10, fontWeight:'700', overflow:'hidden' },
  // Skeleton styles
  skelRow:{},
  skelThumb:{ width:48, height:48, borderRadius:8 },
  skelLineLg:{ width:'60%', height:14, borderRadius:8, marginBottom:8 },
  skelLineSm:{ width:'40%', height:12, borderRadius:8 },
  skelPillWide:{ width:90, height:14, borderRadius:7 },
  skelPill:{ width:60, height:14, borderRadius:7 },
  // Cart styles
  section: { backgroundColor:'#ffffff', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'#f3f4f6' },
  sectionHeaderRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  sectionTitleBtn: { flexDirection:'row', alignItems:'center' },
  chevron: { fontSize:14, color:'#374151', marginRight:4 },
  sectionTitle: { fontSize:16, fontWeight:'700', color:'#111827' },
  sectionActions: { flexDirection:'row', alignItems:'center', gap:12 },
  clearText: { fontSize:12, color:'#ef4444', fontWeight:'600' },
  cartList: { marginTop:8 },
  cartRow: { flexDirection:'row', alignItems:'flex-start', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#f3f4f6' },
  cartThumb: { width:44, height:44, borderRadius:8, backgroundColor:'#e5e7eb' },
  cartName: { fontSize:14, fontWeight:'600', color:'#111827' },
  cartMeta: { fontSize:11, color:'#6b7280', marginTop:2 },
  qtyCol: { alignItems:'center', marginLeft:8 },
  qtyRow: { flexDirection:'row', alignItems:'center', backgroundColor:'#f3f4f6', borderRadius:20, paddingHorizontal:6, paddingVertical:4 },
  qtyBtn: { paddingHorizontal:8, paddingVertical:2 },
  qtyBtnText: { fontSize:16, fontWeight:'700', color:'#111827' },
  qtyValue: { fontSize:13, fontWeight:'700', marginHorizontal:6, color:'#111827' },
  removeLink: { fontSize:10, color:'#ef4444', marginTop:4 },
  totalRow: { flexDirection:'row', justifyContent:'space-between', paddingTop:12, marginTop:4 },
  totalLabel: { fontSize:14, fontWeight:'700', color:'#111827' },
  totalValue: { fontSize:14, fontWeight:'700', color:'#111827' },
  checkoutBtn: { marginTop:12, backgroundColor:'#16a34a', paddingVertical:12, borderRadius:30, alignItems:'center' },
  checkoutText: { color:'#fff', fontWeight:'700', fontSize:14, letterSpacing:0.5 },
  swipeDeleteLayer: { position:'absolute', right:0, top:0, bottom:0, width:120, backgroundColor:'#dc2626', alignItems:'center', justifyContent:'center' },
  deleteBtn: { flex:1, alignItems:'center', justifyContent:'center', width:'100%' },
  deleteBtnText: { color:'#fff', fontWeight:'700', letterSpacing:0.5 },
  undoBar: { position:'absolute', left:16, right:16, bottom:16, backgroundColor:'#111827', paddingHorizontal:16, paddingVertical:12, borderRadius:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between', shadowColor:'#000', shadowOpacity:0.15, shadowRadius:8, elevation:4 },
  undoText: { color:'#f3f4f6', fontSize:13 },
  undoAction: { color:'#60a5fa', fontWeight:'700', fontSize:13 },
})
