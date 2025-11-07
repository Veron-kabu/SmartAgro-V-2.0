import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { useCart } from '../../context/cart'
import { useEffect, useState, useCallback } from 'react'
import { validateCartItems } from '../../utils/cartValidation'
import { checkoutStyles as styles } from '../../assets/styles/orders.styles'
import { COLORS } from '../../constants/colors'
import { useProfile } from '../../context/profile'
import { useToast } from '../../context/toast'
import { initiateStkPush, getStkStatus } from '../../utils/mpesa'
import { postJSON, patchJSON } from '../../context/api'
import { Ionicons } from '@expo/vector-icons'

export default function CheckoutPlaceholder() {
  const router = useRouter()
  const { items, clearCart, updateQuantity, removeItem } = useCart()
  const [validating, setValidating] = useState(true)
  const [adjustments, setAdjustments] = useState([])
  const [currentTotal, setCurrentTotal] = useState(0)
  const [lastStableTotal, setLastStableTotal] = useState(0)
  const [pendingPriceChanges, setPendingPriceChanges] = useState([])
  const [paying, setPaying] = useState(false)
  const { profile } = useProfile()
  const { show } = useToast()
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryObj, setDeliveryObj] = useState(null)
  const [phone, setPhone] = useState('')

  const validate = useCallback(async () => {
    if (!items.length) { setValidating(false); setCurrentTotal(0); setLastStableTotal(0); setAdjustments([]); setPendingPriceChanges([]); return }
    setValidating(true)
  const { adjustments: adj, validated, total } = await validateCartItems(items, { updatePrices: true })
    for (const v of validated) {
      if (v.removed) removeItem(v.id)
      else if (v.quantity !== items.find(i=>i.id===v.id)?.quantity) updateQuantity(v.id, v.quantity)
    }
  const priceChanges = adj.filter(a => a.type === 'price')
  // Prices are auto-applied; keep for visibility only (no user action required)
  setPendingPriceChanges(priceChanges)
    setAdjustments(adj)
    setCurrentTotal(total)
    setLastStableTotal(total)
    setValidating(false)
  }, [items, removeItem, updateQuantity])

  // Manual price change actions removed (auto-applied)

  useEffect(() => { validate() }, [validate])

  // Prefill delivery address from profile, allow override
  useEffect(() => {
    if (!profile) return
    setDeliveryAddress(prev => prev || (typeof profile?.location === 'string' ? profile.location : (profile?.placeName || '')))
    setPhone(prev => prev || (profile?.phone || ''))
    // Clear any stale structured object when profile changes unless user selected explicitly
    setDeliveryObj(null)
  }, [profile])

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

  const payNow = useCallback(async () => {
    if (validating) return
    const amount = Number(currentTotal)
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
                const payload = {
                  checkoutRequestID,
                  items: items.map(it => ({
                    product_id: it.id,
                    quantity: it.quantity,
                    delivery_address: deliveryObj || (deliveryAddress ? { text: deliveryAddress } : null),
                    notes: null
                  }))
                }
                await postJSON('/api/orders/cart-after-payment', payload)
                clearCart()
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
  }, [validating, currentTotal, deliveryAddress, deliveryObj, phone, profile?.phone, items, clearCart, show, router])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checkout (Validation)</Text>
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
      <Text style={styles.meta}>Items: {items.length}</Text>
      <Text style={styles.meta}>Total: KSH {(validating ? lastStableTotal : currentTotal).toFixed(2)}</Text>
      {/* Prices auto-apply on validation; show a lightweight notice if any changed */}
      {!!pendingPriceChanges.length && !validating && (
        <View style={styles.bannerWarning}>
          <Text style={styles.bannerText}>{pendingPriceChanges.length} price change(s) auto-applied.</Text>
        </View>
      )}
      <ScrollView style={{ marginTop:12 }} contentContainerStyle={{ paddingBottom:48 }}>
        <Text style={styles.desc}>Adjusted pricing & availability will surface below. Payment flow coming soon.</Text>
        {adjustments.length > 0 && (
          <View style={{ marginTop:16 }}>
            <Text style={styles.adjustTitle}>Adjustments</Text>
            {adjustments.map(a => {
              let icon = 'ℹ️'; let color = COLORS.text; let text = ''
              if (a.type === 'removed') { icon = '❌'; color = COLORS.error; text = `Removed: ${a.reason || 'Unavailable'}` }
              else if (a.type === 'quantity') { icon = '🔄'; color = COLORS.warningText || COLORS.text; text = `Quantity clamped to ${a.newQuantity}` }
              else if (a.type === 'price') { icon = '💲'; color = COLORS.primary; text = `Price changed ${a.oldPrice} → ${a.newPrice}` }
              else if (a.type === 'error') { icon = '⚠️'; color = COLORS.error; text = `Validation failed (${a.reason || 'Unknown'})` }
              return (
                <View key={a.id + a.type} style={styles.adjustRow}>
                  <Text style={[styles.adjustIcon,{ opacity:0.9 }]}>{icon}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={[styles.adjustLine,{ color }]} numberOfLines={2}>Item #{a.id} – {text}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
      <View style={styles.actionsBar}>
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
