import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, TextInput } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCart } from '../../context/cart'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '../../utils/orders'
import { validateCartItems } from '../../utils/cartValidation'
import { checkoutStyles as styles } from '../../assets/styles/orders.styles'
import { COLORS } from '../../constants/colors'
import { useProfile } from '../../context/profile'
import { useToast } from '../../context/toast'
import { initiateStkPush, getStkStatus } from '../../utils/mpesa'
import { postJSON, patchJSON, getJSON } from '../../context/api'
import { Ionicons } from '@expo/vector-icons'

export default function CheckoutPlaceholder() {
  const router = useRouter()
  const { items, clearCart, updateQuantity, removeItem } = useCart()
  const { singleId, singleQty } = useLocalSearchParams()
  // We'll lazily fetch a single product inside validate() when needed; avoid extra effect
  const [singleItemState, setSingleItemState] = useState(null)
  const [currentTotal, setCurrentTotal] = useState(0)
  const [lastStableTotal, setLastStableTotal] = useState(0)
  const [validating, setValidating] = useState(true)
  const [paying, setPaying] = useState(false)
  // When singleItemState is provided we are checking out a single item
  const itemsCount = singleItemState ? 1 : items.length
  const { profile } = useProfile()
  const { show } = useToast()
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryObj, setDeliveryObj] = useState(null)
  const [phone, setPhone] = useState('')
  const [shippingCost, setShippingCost] = useState(0)
  const [loadingShipping, setLoadingShipping] = useState(false)

  const validate = useCallback(async () => {
    let sourceItems = items
    // If singleId is provided, fetch the latest product data and use that single item
    if (singleId) {
      try {
        const pid = Number(Array.isArray(singleId) ? singleId[0] : singleId)
        if (pid && !Number.isNaN(pid)) {
          const p = await getJSON(`/api/products/${pid}`)
          const qty = Number(Array.isArray(singleQty) ? singleQty[0] : singleQty) || 1
          if (p) {
            sourceItems = [{ ...p, quantity: qty }]
            setSingleItemState(sourceItems[0])
          }
        }
      } catch (_e) {
        // If fetch fails, fall back to an empty list so validation clears
        sourceItems = []
      }
    }

    // Guard: no items -> clear totals and avoid running validation request
    if (!sourceItems.length) { setValidating(false); setCurrentTotal(0); setLastStableTotal(0); return }

    setValidating(true)
    try {
      const { validated, total } = await validateCartItems(sourceItems, { updatePrices: true })
      for (const v of validated) {
        if (v.removed) {
          if (!singleId) removeItem(v.id)
        } else if (!singleId && v.quantity !== items.find(i=>i.id===v.id)?.quantity) {
          updateQuantity(v.id, v.quantity)
        }
      }
      // Note: adjustments returned by validation are ignored (UI simplified per UX request)
      setCurrentTotal(total)
      setLastStableTotal(total)
    } catch (e) {
      console.warn('Cart validation failed:', e)
      // keep last stable totals if available
    } finally {
      setValidating(false)
    }
  }, [items, removeItem, updateQuantity, singleId, singleQty])

  // Manual price change actions removed (auto-applied)

  useEffect(() => { validate() }, [validate])

  // Prefill delivery address from profile, allow override
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

  // Calculate shipping cost when items (or single item) and delivery location are available
  useEffect(() => {
    const calculateShipping = async () => {
      const sourceItems = singleItemState ? [singleItemState] : items
      if (!sourceItems.length || !deliveryObj?.coords) {
        setShippingCost(0)
        return
      }
      const destLat = deliveryObj.coords.lat
      const destLng = deliveryObj.coords.lng
      if (!destLat || !destLng) { setShippingCost(0); return }
      try {
        setLoadingShipping(true)
        const prodId = sourceItems[0]?.id
        if (!prodId) { setShippingCost(0); return }
        const response = await getJSON(`/api/shipping/quote?product_id=${prodId}&dest_lat=${destLat}&dest_lng=${destLng}`)
        setShippingCost(Number(response?.shippingCost || 0))
      } catch (e) {
        console.warn('Failed to fetch shipping cost for checkout:', e)
        setShippingCost(0)
      } finally {
        setLoadingShipping(false)
      }
    }
    calculateShipping()
  }, [items, singleItemState, deliveryObj])

  const payNow = useCallback(async () => {
    if (validating) return
    const subtotal = validating ? lastStableTotal : currentTotal
    const total = subtotal + shippingCost
    const amount = Math.round(Number(total))
    const buyerPhone = (phone || '').trim()
  if (!buyerPhone) { show('Enter a phone number to pay via M-Pesa.', { type: 'warning' }); return }
    if (!deliveryAddress || !deliveryAddress.trim()) { show('Add a delivery address before paying.', { type: 'warning' }); return }
    if (!Number.isFinite(amount) || amount <= 0) { show('Invalid total amount', { type: 'error' }); return }
    try {
      setPaying(true)
      // Persist phone if newly provided or changed
      if ((buyerPhone && buyerPhone !== (profile?.phone || ''))) {
        try { await patchJSON('/api/users/profile', { phone: buyerPhone }) } catch {}
      }
  const resp = await initiateStkPush({ phone: buyerPhone, amount, accountReference: 'SmartAgro Cart', transactionDesc: 'Cart payment' })
      show('Prompt sent. Enter M-Pesa PIN to continue…', { type: 'info' })
      const checkoutRequestID = resp?.checkoutRequestID || resp?.CheckoutRequestID
      if (checkoutRequestID) {
        // Poll a few times to confirm result, then redirect
        let attempts = 0
        while (attempts < 20) {
          attempts++
          try {
            const q = await getStkStatus(checkoutRequestID)
            const code = String(q?.ResultCode ?? q?.resultCode ?? '')
            if (code === '0') {
              // Create orders for all cart items in one go
              try {
                const processingItems = singleItemState ? [singleItemState] : items
                const payload = {
                  checkoutRequestID,
                  items: processingItems.map(it => ({
                    product_id: it.id,
                    quantity: it.quantity,
                    delivery_address: deliveryObj || (deliveryAddress ? { text: deliveryAddress } : null),
                    notes: null
                  }))
                }
                await postJSON('/api/orders/cart-after-payment', payload)
                if (!singleItemState) clearCart()
                else removeItem && removeItem(singleItemState.id)
              } catch (e) {
                // Surface a warning but still navigate; list may update after retry
                show(e?.body || e?.message || 'Payment received but order creation failed; will retry shortly.', { type: 'warning' })
              }
              show('Payment received. Redirecting…', { type: 'success' });
              router.replace('/orders/buyerorders?view=sent')
              break
            }
            if (['1032','1037','1','2001','2002'].includes(code)) { show('Payment was not completed.', { type: 'error' }); break }
          } catch {}
          await new Promise(r => setTimeout(r, 2500))
        }
        if (attempts >= 20) {
          show('We couldn’t confirm payment yet. Your orders will update shortly if it completes.', { type: 'warning' })
        }
      }
    } catch (e) {
      show(e?.body || e?.message || 'Failed to start payment', { type: 'error' })
    } finally {
      setPaying(false)
    }
  }, [validating, currentTotal, lastStableTotal, shippingCost, deliveryAddress, deliveryObj, phone, profile?.phone, items, clearCart, show, router, removeItem, singleItemState])

  return (
    <View style={styles.container}>
      {singleItemState && (
        <View style={{ marginTop: 12, marginHorizontal: 12, padding: 10, borderRadius: 8, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7ddff' }}>
          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Purchasing only this item</Text>
          <Text style={{ color: COLORS.text, marginTop: 6 }} numberOfLines={1}>{singleItemState?.title || ''}</Text>
        </View>
      )}
        {/* Delivery address input with map picker */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.meta}>Delivery Address</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <TextInput
              style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, minHeight: 44, color: COLORS.text }}
              value={deliveryAddress}
              onChangeText={(t) => { setDeliveryAddress(t); setDeliveryObj(null) }}
              placeholder="Enter delivery address or pick on map"
            />
            <TouchableOpacity onPress={() => router.push({ pathname: '/location-picker', params: { mode: 'delivery' } })} activeOpacity={0.85} style={{ padding: 8 }}>
              <Ionicons name="location" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ marginTop: 20 }}>
          <Text style={styles.meta}>Phone Number</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, height: 44, color: COLORS.text, marginTop:8 }}
            keyboardType='phone-pad'
            value={phone}
            onChangeText={setPhone}
            placeholder="+254xxxxxxxxx"
          />
          {/* Helper removed as requested */}
        </View>
      {validating && (
        <View style={{ marginTop:16, flexDirection:'row', alignItems:'center' }}>
          <ActivityIndicator size='small' color={COLORS.primary} />
          <Text style={[styles.desc,{ marginLeft:8 }]}>Validating cart…</Text>
        </View>
      )}
      <View style={{ marginTop: 12, paddingHorizontal: 12 }}>
        <Text style={styles.meta}>Items: {itemsCount}</Text>
        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.desc}>Subtotal</Text>
            <Text style={styles.desc}>{formatCurrency(validating ? lastStableTotal : currentTotal)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.desc}>Shipping {loadingShipping ? '(calculating...)' : ''}</Text>
            <Text style={styles.desc}>{loadingShipping ? '...' : `Ksh ${shippingCost.toFixed(2)}`}</Text>
          </View>
          {!deliveryObj?.coords && (
            <Text style={{ color: COLORS.warning, fontSize: 11, marginBottom: 8 }}>
              Select location on map to calculate shipping
            </Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <Text style={{ fontWeight: '700' }}>Total: {formatCurrency((validating ? lastStableTotal : currentTotal) + shippingCost)}</Text>
          </View>
        </View>
      </View>
      <ScrollView style={{ marginTop:12 }} contentContainerStyle={{ paddingBottom:140 }}>
        {/* Adjustments and auto-applied price notices removed per UX request */}
      </ScrollView>
      <View style={[styles.actionsBar, { marginBottom: 24 }] }>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: (validating || paying) ? '#9ca3af' : COLORS.primary }]}
          onPress={payNow}
          disabled={validating || paying}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 }}>
            {paying ? <ActivityIndicator size="small" color={COLORS.white} /> : null}
            <Text style={styles.primaryText}>{paying ? 'Sending…' : 'Pay Now (M-Pesa)'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn,{marginTop:12}]} onPress={() => { clearCart(); router.back() }} disabled={validating}>
          <Text style={styles.secondaryText}>Clear & Close</Text></TouchableOpacity>
      </View>
    </View>
  )
}
