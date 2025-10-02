"use client"

import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native'
import { getJSON, postJSON } from '../../context/api'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'
import { formatCurrency } from '../../utils/orders'
import { emitAppEvent } from '../../context/favorites'
import { useToast } from '../../context/toast'
import { useProfile } from '../../context/profile'

export default function NewOrderScreen() {
  const { product: productParam } = useLocalSearchParams()
  const productId = productParam ? Number(productParam) : null
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [deliveryAddress, setDeliveryAddress] = useState('')
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
  const created = await postJSON('/api/orders', { product_id: productId, quantity: qty, delivery_address: deliveryAddress.trim(), notes: notes.trim() || undefined })
  track(ANALYTICS_EVENTS.ORDER_CREATED, { orderId: created.id, productId, quantity: qty })
      // Update local product snapshot & emit global event for UI refresh elsewhere
      if (typeof created.remainingQuantity === 'number') {
        setProduct(prev => prev ? { ...prev, quantityAvailable: created.remainingQuantity, status: created.productStatus || prev.status } : prev)
        emitAppEvent('product:stockChanged', { productId, remaining: created.remainingQuantity, status: created.productStatus })
      }
      show('Order placed!', { type: 'success' })
  router.replace('/orders/buyerorders')
    } catch (e) {
      Alert.alert('Order Failed', e?.body || e?.message || 'Could not create order')
    } finally { setSubmitting(false) }
  }

  if (!profile) {
    return <View style={styles.center}><ActivityIndicator color="#16a34a" /></View>
  }
  // Allow both buyers and farmers to place orders (farmers act as buyers for others' listings)
  if (!['buyer','farmer'].includes(profile.role)) {
    return <View style={styles.center}><Text style={styles.muted}>Only buyers or farmers can place orders.</Text></View>
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#16a34a" /></View>
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
    <ScrollView contentContainerStyle={{ padding: 20 }} style={{ flex:1, backgroundColor: '#f9fafb' }}>
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
        <TextInput
          style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          placeholder='Enter delivery address'
        />
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
          <TouchableOpacity disabled={submitting} onPress={submit} style={[styles.button, submitting && { opacity: 0.6 }]}>
            <Text style={styles.buttonText}>{submitting ? 'Placing...' : 'Place Order'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#f9fafb' },
  card: { backgroundColor:'#fff', borderRadius:16, padding:20, elevation:2 },
  title: { fontSize:22, fontWeight:'700', marginBottom:12, color:'#111827' },
  label: { fontWeight:'600', fontSize:14, color:'#374151', marginBottom:4 },
  value: { fontSize:16, fontWeight:'500', color:'#111827', marginBottom:4 },
  input: { backgroundColor:'#f3f4f6', borderRadius:8, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#111827' },
  helper: { fontSize:12, color:'#6b7280', marginTop:4 },
  muted: { color:'#6b7280' },
  mutedSmall: { color:'#6b7280', fontSize:12, marginBottom:4 },
  total: { fontSize:16, fontWeight:'700', color:'#111827' },
  button: { backgroundColor:'#16a34a', paddingHorizontal:18, paddingVertical:12, borderRadius:10 },
  buttonText: { color:'#fff', fontWeight:'700' }
})
