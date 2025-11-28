import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { useEffect, useState, useCallback, useLayoutEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import { View, Text, ActivityIndicator, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getJSON, postJSON, patchJSON } from '../../context/api'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'
import { formatCurrency } from '../../utils/orders'
import { emitAppEvent } from '../../context/favorites'
import { useToast } from '../../context/toast'
import { newOrderStyles as styles, checkoutStyles } from '../../assets/styles/orders.styles'
import { useProfile } from '../../context/profile'
import { initiateStkPush, getStkStatus } from '../../utils/mpesa'
import { COLORS } from '../../constants/colors'

export default function NewOrderScreen() {
  const params = useLocalSearchParams()
  const productParam = params.product
  const qtyParam = params.qty
  const productId = productParam ? Number(productParam) : null
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [quantity, setQuantity] = useState(qtyParam ? String(qtyParam) : '1')
  const navigation = useNavigation()
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryObj, setDeliveryObj] = useState(null)
  const [phone, setPhone] = useState('')
  const [shippingCost, setShippingCost] = useState(0)
  const [loadingShipping, setLoadingShipping] = useState(false)
  const { profile, refresh: refreshProfile } = useProfile()
  const { show } = useToast()
  
  // Refresh profile when screen comes into focus (e.g., after verification)
  useFocusEffect(
    useCallback(() => {
      refreshProfile()
    }, [refreshProfile])
  )

  const load = useCallback(async () => {
    if (!productId) { setLoading(false); return }
    try {
      const p = await getJSON(`/api/products/${productId}`)
      setProduct(p)
    } catch (_e) {
      Alert.alert('Error', 'Failed to load product')
    } finally { setLoading(false) }
  }, [productId])

  useEffect(() => { load() }, [load])

  // Hide native header and use an in-page header for consistent UI
  useLayoutEffect(() => {
    try { navigation.setOptions({ headerShown: false }) } catch (_e) {}
  }, [navigation])

  // Prefill delivery address from profile on first render
  useEffect(() => {
    if (!profile) return
    // Build address from normalized fields (latitude/longitude/placeName) or legacy location blob
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
    setPhone(prev => prev || (profile?.phone || ''))
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

  // Calculate shipping cost when product and delivery location are available
  useEffect(() => {
    const calculateShipping = async () => {
      if (!product || !deliveryObj?.coords) {
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
        const response = await getJSON(`/api/shipping/quote?product_id=${product.id}&dest_lat=${destLat}&dest_lng=${destLng}`)
        setShippingCost(Number(response?.shippingCost || 0))
      } catch (e) {
        console.warn('Failed to fetch shipping cost:', e)
        setShippingCost(0)
      } finally {
        setLoadingShipping(false)
      }
    }

    calculateShipping()
  }, [product, deliveryObj])

  async function submit() {
    if (!productId) return
    const qty = Number(quantity)
    const min = Number(product?.minimumOrder || 1)
    const stock = Number(product?.quantityAvailable || 0)
    if (!Number.isInteger(qty) || qty <= 0) return Alert.alert('Invalid quantity', 'Enter a positive whole number')
    if (qty < min) return Alert.alert('Too Low', `Minimum order is ${min}`)
    if (qty > stock) return Alert.alert('Too High', `Only ${stock} in stock`)
    if (!deliveryAddress.trim()) return Alert.alert('Missing address', 'Delivery address is required')
    setSubmitting(true)
    try {
      // Do NOT create the order yet. First take payment, then create.
      const buyerPhone = (phone || '').trim()
      if (!buyerPhone) {
        show('Enter a phone number to pay via M-Pesa.', { type: 'warning' })
        return
      }
      // M-Pesa requires whole numbers (no decimals)
      const amount = Math.round(Number(total))
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert('Invalid total', 'Could not compute total amount')
        return
      }
      show('Sending payment request…', { type: 'info' })
      // Persist phone if newly provided or changed
      if ((buyerPhone && buyerPhone !== (profile?.phone || ''))) {
        try { await patchJSON('/api/users/profile', { phone: buyerPhone }) } catch {}
      }
      const resp = await initiateStkPush({ phone: buyerPhone, amount, accountReference: 'SmartAgro Order', transactionDesc: `Product #${productId}` })
      const checkoutRequestID = resp?.checkoutRequestID || resp?.CheckoutRequestID
      if (!checkoutRequestID) throw new Error('Failed to start payment')
      show('Prompt sent. Enter M-Pesa PIN to continue…', { type: 'info' })
      // Poll for payment success
      let attempts = 0
      let paid = false
      while (attempts < 30) {
        attempts += 1
        try {
          const q = await getStkStatus(checkoutRequestID)
          const code = String(q?.ResultCode ?? q?.resultCode ?? '')
          if (code === '0') { paid = true; break }
          if (['1032','1037','1','2001','2002'].includes(code)) break
        } catch {}
        await new Promise(r => setTimeout(r, 2500))
      }
      if (!paid) { show('Payment not completed. Order was not created.', { type: 'warning' }); return }
      // Create the order as paid using the confirmed payment session
      const orderPayload = {
        product_id: productId,
        quantity: qty,
        delivery_address: deliveryObj || (deliveryAddress.trim() ? { text: deliveryAddress.trim() } : null),
        checkoutRequestID,
      }
      
      // Include destination coordinates for shipping calculation if available
      if (deliveryObj?.coords?.lat && deliveryObj?.coords?.lng) {
        orderPayload.dest_lat = deliveryObj.coords.lat
        orderPayload.dest_lng = deliveryObj.coords.lng
      }
      
      const created = await postJSON('/api/orders/after-payment', orderPayload)
      track(ANALYTICS_EVENTS.ORDER_CREATED, { orderId: created.id, productId, quantity: qty })
      if (typeof created.remainingQuantity === 'number') {
        setProduct(prev => prev ? { ...prev, quantityAvailable: created.remainingQuantity, status: created.productStatus || prev.status } : prev)
        emitAppEvent('product:stockChanged', { productId, remaining: created.remainingQuantity, status: created.productStatus })
      }
      show('Payment received. Order created!', { type: 'success' })
      router.replace('/orders/buyerorders?view=sent')
    } catch (e) {
      Alert.alert('Order Failed', e?.body || e?.message || 'Could not create order')
    } finally { setSubmitting(false) }
  }

  if (!profile) {
  return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
  }
  // Allow both buyers and farmers to place orders (farmers act as buyers for others' listings)
  if (!['buyer','farmer'].includes(profile.role)) {
    return <View style={styles.center}><Text style={styles.muted}>Only buyers or farmers can place orders.</Text></View>
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
  if (!product) return <View style={styles.center}><Text style={styles.muted}>Product not found.</Text></View>

  const isSelfOwned = profile.role === 'farmer' && product?.farmerId === profile.id
  if (isSelfOwned) {
    return (
      <View style={styles.center}>
  <Text style={styles.muted}>You can&apos;t place an order on your own product.</Text>
      </View>
    )
  }

  const qtyNum = Number(quantity) || 0
  const price = Number(product.price || 0)
  const discount = Number(product.discountPercent || 0)
  const effectiveUnit = discount > 0 ? price * (1 - discount / 100) : price
  const subtotal = qtyNum * effectiveUnit
  const total = subtotal + shippingCost

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} style={{ flex:1, backgroundColor: COLORS.background }} keyboardShouldPersistTaps="handled">
      {/* Header removed as requested */}
      {String(profile?.status || '').toLowerCase() === 'suspended' && (
        <View style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#B91C1C', fontWeight: '700' }}>Account suspended</Text>
          <Text style={{ color: '#7F1D1D', marginTop: 4, fontSize: 12 }}>You cannot place orders until your account is reactivated.</Text>
        </View>
      )}
      <View style={{ padding: 0, backgroundColor: 'transparent' }}>
        <View style={{ height: 44, justifyContent: 'center', alignItems: 'center', position: 'relative', marginBottom: 6 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: 0, padding: 6 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { textAlign: 'center', marginLeft: 0 }]}>{product?.title ? product.title : 'New Order'}</Text>
          </View>
        {/* Price, In Stock, and minimum order removed as requested */}
        <View style={{ height: 16 }} />
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          keyboardType='number-pad'
          value={quantity}
          onChangeText={setQuantity}
          placeholder='Quantity'
        />
  {/* Minimum order helper removed */}
        <View style={{ height: 16 }} />
        <Text style={styles.label}>Delivery Address</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top', flex: 1 }]}
            multiline
            value={deliveryAddress}
            onChangeText={(t) => { setDeliveryAddress(t); setDeliveryObj(null) }}
            placeholder='Enter delivery address'
          />
          <TouchableOpacity onPress={() => router.push({ pathname: '/location-picker', params: { mode: 'delivery' } })} activeOpacity={0.85} style={{ padding: 8 }}>
            <Ionicons name="location" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={{ height: 16 }} />
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          keyboardType='phone-pad'
          value={phone}
          onChangeText={(t) => { setPhone(t) }}
          placeholder='Phone number for payment & contact'
        />
        {(!phone || phone.trim().length < 7) && <Text style={styles.helper}>Enter a valid phone (min 7 digits)</Text>}
        <View style={{ height: 20 }} />
        
        {/* Price breakdown (matches order-summary) */}
        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.mutedSmall}>Subtotal</Text>
            <Text style={styles.mutedSmall}>{`Ksh ${subtotal.toFixed(2)}`}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.mutedSmall}>Shipping Fee</Text>
            <Text style={styles.mutedSmall}>{loadingShipping ? '...' : `Ksh ${shippingCost.toFixed(2)}`}</Text>
          </View>
          {/* Tax removed per request */}
          {!deliveryObj?.coords && (
            <Text style={{ color: COLORS.warning, fontSize: 11, marginBottom: 8 }}>
              Select location on map to calculate shipping
            </Text>
          )}
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.total, { fontSize: 18 }]}>Total</Text>
            <Text style={[styles.total, { fontSize: 20 }]}>{`Ksh ${total.toFixed(2)}`}</Text>
          </View>
          <TouchableOpacity disabled={submitting || String(profile?.status||'').toLowerCase()==='suspended'} onPress={submit} style={[checkoutStyles.primaryBtn, (submitting || String(profile?.status||'').toLowerCase()==='suspended') && { opacity: 0.6 }]}>
            <Text style={checkoutStyles.primaryText}>{submitting ? 'Placing...' : 'Place Order'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}
