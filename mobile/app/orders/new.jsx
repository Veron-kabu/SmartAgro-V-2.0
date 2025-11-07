import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, ActivityIndicator, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getJSON, postJSON, patchJSON } from '../../context/api'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'
import { formatCurrency } from '../../utils/orders'
import { emitAppEvent } from '../../context/favorites'
import { useToast } from '../../context/toast'
import { newOrderStyles as styles } from '../../assets/styles/orders.styles'
import { useProfile } from '../../context/profile'
import { initiateStkPush, getStkStatus } from '../../utils/mpesa'
import { COLORS } from '../../constants/colors'

export default function NewOrderScreen() {
  const { product: productParam } = useLocalSearchParams()
  const productId = productParam ? Number(productParam) : null
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryObj, setDeliveryObj] = useState(null)
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const { profile } = useProfile()
  const { show } = useToast()

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

  // Prefill delivery address from profile on first render
  useEffect(() => {
    if (!profile) return
    setDeliveryAddress(prev => prev || (typeof profile?.location === 'string' ? profile.location : (profile?.placeName || '')))
    setPhone(prev => prev || (profile?.phone || ''))
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
      const amount = Number(total)
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
      const created = await postJSON('/api/orders/after-payment', {
        product_id: productId,
        quantity: qty,
        delivery_address: deliveryObj || (deliveryAddress.trim() ? { text: deliveryAddress.trim() } : null),
        notes: notes.trim() || undefined,
        checkoutRequestID,
      })
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
  const total = qtyNum * effectiveUnit

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} style={{ flex:1, backgroundColor: '#f9fafb' }} keyboardShouldPersistTaps="handled">
      {String(profile?.status || '').toLowerCase() === 'suspended' && (
        <View style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#B91C1C', fontWeight: '700' }}>Account suspended</Text>
          <Text style={{ color: '#7F1D1D', marginTop: 4, fontSize: 12 }}>You cannot place orders until your account is reactivated.</Text>
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.title}>New Order</Text>
        <Text style={styles.label}>Product</Text>
        <Text style={styles.value}>{product.title}</Text>
        <Text style={styles.mutedSmall}>
          Price: {discount > 0 ? `${formatCurrency(effectiveUnit)} (was ${formatCurrency(price)})` : formatCurrency(price)} / {product.unit}
        </Text>
        <Text style={styles.mutedSmall}>In Stock: {product.quantityAvailable}  {product.minimumOrder && product.minimumOrder > 1 ? ` • Min: ${product.minimumOrder}` : ''}</Text>
        <View style={{ height: 16 }} />
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          keyboardType='number-pad'
          value={quantity}
          onChangeText={setQuantity}
          placeholder='Quantity'
        />
  <Text style={styles.helper}>{product.minimumOrder ? `Minimum order: ${product.minimumOrder}` : ''}</Text>
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
        <View style={{ height: 16 }} />
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder='Any extra details'
        />
        <View style={{ height: 20 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.total}>Total: {formatCurrency(total)}</Text>
          <TouchableOpacity disabled={submitting || String(profile?.status||'').toLowerCase()==='suspended'} onPress={submit} style={[styles.button, (submitting || String(profile?.status||'').toLowerCase()==='suspended') && { opacity: 0.6 }]}>
            <Text style={styles.buttonText}>{submitting ? 'Placing...' : 'Place Order'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}
