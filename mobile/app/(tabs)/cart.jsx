import { View, Text, Alert, ScrollView, TouchableOpacity, RefreshControl, FlatList } from "react-native";
import { COLORS } from '../../constants/colors'
import { useEffect, useState, useRef, useCallback } from 'react'
import * as Haptics from 'expo-haptics'
import { getJSON } from '../../context/api'
import { useCart } from '../../context/cart'
import { cartStyles } from '../../assets/styles/(tabs)/cart.styles'
import { favoritesStyles } from "../../assets/styles/(tabs)/favorites.styles";
import { Ionicons } from "@expo/vector-icons";
import { useProfile } from '../../context/profile'
import { formatCurrency } from '../../utils/orders'
import EmptyState from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";
import ProductCard from "../../components/ProductCard";
import { router } from 'expo-router'
// CountBadge not used in cart UI (favorites shows favourite count)

const CartScreen = () => {
  const { items: cartItems, addItem, removeItem } = useCart()

  const [refreshing, setRefreshing] = useState(false)
  const [priceMap, setPriceMap] = useState({})
  const [loading, setLoading] = useState(false)
  const initialLoadedRef = useRef(false)

  const undoTimeoutRef = useRef(null)
  const [undoData, setUndoData] = useState(null)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    const ids = cartItems.map(i => i.id).filter(Boolean)
    if (ids.length) {
      try {
        const bulk = await getJSON(`/api/products/bulk?ids=${ids.join(',')}`)
        if (Array.isArray(bulk)) {
          const map = {}
          for (const p of bulk) map[p.id] = { price: Number(p.price)||0, discountPercent: Number(p.discountPercent||0), unit: p.unit }
          setPriceMap(map)
        }
      } catch {}
    }
    setRefreshing(false)
  }, [cartItems])

  useEffect(() => {
    const ids = cartItems.map(i => i.id).filter(Boolean)
    if (!ids.length) { setPriceMap({}); return }
    let cancelled = false
    ;(async () => {
      try {
        // For the very first load show the full-screen loader. Subsequent updates happen
        // in the background so they don't cause the cart screen to disappear on small changes.
        if (!initialLoadedRef.current) setLoading(true)
        const bulk = await getJSON(`/api/products/bulk?ids=${ids.join(',')}`)
        if (cancelled) return
        if (Array.isArray(bulk)) {
          const map = {}
          for (const p of bulk) map[p.id] = { price: Number(p.price)||0, discountPercent: Number(p.discountPercent||0), unit: p.unit }
          setPriceMap(map)
        }
      } catch (_e) {
      } finally {
        if (!initialLoadedRef.current) {
          setLoading(false)
          initialLoadedRef.current = true
        }
      }
    })()
    return () => { cancelled = true }
  }, [cartItems])

  const effectiveUnit = useCallback((item) => {
    const meta = priceMap[item.id]
    const base = Number((meta?.price ?? item.price) || 0)
    const disc = Number((meta?.discountPercent ?? item.discountPercent) || 0)
    return disc > 0 ? Math.round((base * (1 - disc/100)) * 100) / 100 : Math.round(base * 100) / 100
  }, [priceMap])

  const discountedCartTotal = useCallback(() => {
    return cartItems.reduce((sum, it) => sum + effectiveUnit(it) * Number(it.quantity||0), 0)
  }, [cartItems, effectiveUnit])

  // Shipping & address state (copied from new order implementation)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryObj, setDeliveryObj] = useState(null)
  const [shippingCost, setShippingCost] = useState(0)
  const [loadingShipping, setLoadingShipping] = useState(false)
  const { profile } = useProfile()

  // Prefill delivery address from profile on first render
  useEffect(() => {
    if (!profile) return
    let addressText = ''
    if (profile.placeName) {
      addressText = profile.placeName
    } else if (typeof profile.location === 'string') {
      addressText = profile.location
    } else if (profile.location?.name) {
      addressText = profile.location.name
    } else if (profile.latitude && profile.longitude) {
      addressText = `${Number(profile.latitude).toFixed(4)}, ${Number(profile.longitude).toFixed(4)}`
    }
    setDeliveryAddress(prev => prev || addressText)
    // Store structured location if available
    if (profile.latitude && profile.longitude && !deliveryObj) {
      setDeliveryObj({
        text: addressText,
        coords: { lat: Number(profile.latitude), lng: Number(profile.longitude) },
        details: profile.addressDetails || null
      })
    }
  }, [profile, deliveryObj])

  // Listen for delivery address picked from map
  useEffect(() => {
    const { on, off } = require('../../utils/eventBus')
    const handler = (payload) => {
      if (payload?.address) setDeliveryAddress(payload.address)
      if (payload) setDeliveryObj({ text: payload.address || '', coords: payload.coords || null, details: payload.details || null })
    }
    on('location:delivery-selected', handler)
    return () => off('location:delivery-selected', handler)
  }, [])

  // Calculate shipping cost when cart and delivery location are available
  useEffect(() => {
    const calculateShipping = async () => {
      if (!cartItems.length || !deliveryObj?.coords) {
        setShippingCost(0)
        return
      }
      const destLat = deliveryObj.coords.lat
      const destLng = deliveryObj.coords.lng
      if (!destLat || !destLng) {
        setShippingCost(0)
        return
      }
      try {
        setLoadingShipping(true)
        // Use the first product id as representative for shipping quote
        const prodId = cartItems[0]?.id
        if (!prodId) { setShippingCost(0); return }
        const response = await getJSON(`/api/shipping/quote?product_id=${prodId}&dest_lat=${destLat}&dest_lng=${destLng}`)
        setShippingCost(Number(response?.shippingCost || 0))
      } catch (e) {
        console.warn('Failed to fetch shipping cost for cart:', e)
        setShippingCost(0)
      } finally {
        setLoadingShipping(false)
      }
    }
    calculateShipping()
  }, [cartItems, deliveryObj])

  

  // performDelete kept available for future swipe-to-delete UX if needed

  if (loading) return <LoadingSpinner message="Loading your cart..." />

  return (
    <View style={cartStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
        <View style={cartStyles.header}>
          <Text style={cartStyles.title}>Cart</Text>
        </View>

        {/* Top checkout card (visible when cart has items) - show subtotal/shipping breakdown */}
        {cartItems.length > 0 && (
          <View style={cartStyles.checkoutWrap}>
            <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontWeight: '700', marginBottom: 8 }}>Summary</Text>
              <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: '#6b7280' }}>Subtotal ({cartItems.reduce((s, it) => s + Number(it.quantity||0), 0)} items)</Text>
                  <Text style={{ color: '#6b7280' }}>{formatCurrency(discountedCartTotal())}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: '#6b7280' }}>Shipping {loadingShipping ? '(calculating...)' : ''}</Text>
                  <Text style={{ color: '#6b7280' }}>{loadingShipping ? '...' : `Ksh ${shippingCost.toFixed(2)}`}</Text>
                </View>
                {deliveryAddress ? (
                  <Text style={{ color: '#374151', fontSize: 12, marginBottom: 8 }}>Deliver to: {deliveryAddress}</Text>
                ) : (!deliveryObj?.coords ? (
                  <Text style={{ color: COLORS.warning, fontSize: 11, marginBottom: 8 }}>
                    Select location on map to calculate shipping
                  </Text>
                ) : null)}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '700' }}>Total: {formatCurrency(discountedCartTotal() + shippingCost)}</Text>
                <TouchableOpacity style={[cartStyles.checkoutButton, { paddingHorizontal: 14 }]} activeOpacity={0.85} onPress={() => router.push('/orders/checkout')}>
                  <Ionicons name="card" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={cartStyles.checkoutText}>Checkout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View style={favoritesStyles.productsSection}>
          <FlatList
            data={cartItems}
            renderItem={({ item }) => {
              const handleBuy = () => {
                try {
                  router.push({ pathname: '/orders/checkout', params: { singleId: String(item.id), singleQty: String(item.quantity || 1) } })
                } catch (_err) {
                  router.push('/orders/checkout')
                }
              }

              const handleRemove = () => {
                Alert.alert('Remove item', `Remove "${item.title}" from cart?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => {
                    // set undo data and remove
                    setUndoData({ item })
                    removeItem(item.id)
                    Haptics.selectionAsync().catch(()=>{})
                    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
                    undoTimeoutRef.current = setTimeout(() => setUndoData(null), 6000)
                  } }
                ])
              }

              return (
                <View style={cartStyles.productWrapper}>
                  <ProductCard product={item} inCart={true} onBuy={handleBuy} onRemove={handleRemove} />
                </View>
              )
            }}
            keyExtractor={(item) => item.id?.toString()}
            numColumns={2}
            columnWrapperStyle={favoritesStyles.row}
            contentContainerStyle={favoritesStyles.productsGrid}
            scrollEnabled={false}
            ListEmptyComponent={<EmptyState context="cart" />}
          />
        </View>
      </ScrollView>

      {undoData && (
        <View style={cartStyles.undoSnackbar}>
          <View style={cartStyles.undoContent}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
            <Text style={cartStyles.undoText}>Removed {undoData.item.title}</Text>
          </View>
          <TouchableOpacity style={cartStyles.undoButton} onPress={() => { if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); addItem(undoData.item, undoData.item.quantity); Haptics.selectionAsync().catch(()=>{}); setUndoData(null) }}>
            <Text style={cartStyles.undoButtonText}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export default CartScreen

