import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useCart } from '../../context/cart'
import { useEffect, useState, useCallback } from 'react'
import { validateCartItems } from '../../utils/cartValidation'

export default function CheckoutPlaceholder() {
  const router = useRouter()
  const { items, clearCart, updateQuantity, removeItem, updateItemPrice } = useCart()
  const [validating, setValidating] = useState(true)
  const [adjustments, setAdjustments] = useState([])
  const [currentTotal, setCurrentTotal] = useState(0)
  const [lastStableTotal, setLastStableTotal] = useState(0)
  const [pendingPriceChanges, setPendingPriceChanges] = useState([])

  const validate = useCallback(async () => {
    if (!items.length) { setValidating(false); setCurrentTotal(0); setLastStableTotal(0); setAdjustments([]); setPendingPriceChanges([]); return }
    setValidating(true)
    const { adjustments: adj, validated, total } = await validateCartItems(items, { updatePrices: false })
    for (const v of validated) {
      if (v.removed) removeItem(v.id)
      else if (v.quantity !== items.find(i=>i.id===v.id)?.quantity) updateQuantity(v.id, v.quantity)
    }
    const priceChanges = adj.filter(a => a.type === 'price')
    setPendingPriceChanges(priceChanges)
    setAdjustments(adj)
    setCurrentTotal(total)
    setLastStableTotal(total)
    setValidating(false)
  }, [items, removeItem, updateQuantity])

  const applyAllPriceChanges = async () => {
    if (!pendingPriceChanges.length) return
    setValidating(true)
    pendingPriceChanges.forEach(pc => updateItemPrice(pc.id, pc.newPrice))
    // Revalidate to clean price adjustments (should now disappear)
    const { adjustments: adj2, total: total2 } = await validateCartItems(items.map(i => ({ ...i })), { updatePrices: false })
    setAdjustments(adj2.filter(a => a.type !== 'price'))
    setPendingPriceChanges([])
    setCurrentTotal(total2)
    setLastStableTotal(total2)
    setValidating(false)
  }

  const keepOldPrices = () => {
    setPendingPriceChanges([])
  }

  useEffect(() => { validate() }, [validate])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checkout (Validation)</Text>
      {validating && (
        <View style={{ marginTop:16, flexDirection:'row', alignItems:'center' }}>
          <ActivityIndicator size='small' color='#16a34a' />
          <Text style={[styles.desc,{ marginLeft:8 }]}>Validating cart…</Text>
        </View>
      )}
      <Text style={styles.meta}>Items: {items.length}</Text>
      <Text style={styles.meta}>Total: KSH {(validating ? lastStableTotal : currentTotal).toFixed(2)}</Text>
      {!!pendingPriceChanges.length && !validating && (
        <View style={styles.bannerWarning}>
          <Text style={styles.bannerText}>{pendingPriceChanges.length} price change(s) detected.</Text>
          <View style={styles.bannerActions}>
            <TouchableOpacity onPress={keepOldPrices} style={styles.bannerBtn}><Text style={styles.bannerBtnText}>Keep Old</Text></TouchableOpacity>
            <TouchableOpacity onPress={applyAllPriceChanges} style={[styles.bannerBtn, styles.bannerBtnPrimary]}><Text style={[styles.bannerBtnText,{color:'#fff'}]}>Apply All</Text></TouchableOpacity>
          </View>
        </View>
      )}
      <ScrollView style={{ marginTop:12 }} contentContainerStyle={{ paddingBottom:48 }}>
        <Text style={styles.desc}>Adjusted pricing & availability will surface below. Payment flow coming soon.</Text>
        {adjustments.length > 0 && (
          <View style={{ marginTop:16 }}>
            <Text style={styles.adjustTitle}>Adjustments</Text>
            {adjustments.map(a => {
              let icon = 'ℹ️'; let color = '#374151'; let text = ''
              if (a.type === 'removed') { icon = '❌'; color = '#dc2626'; text = `Removed: ${a.reason || 'Unavailable'}` }
              else if (a.type === 'quantity') { icon = '🔄'; color = '#d97706'; text = `Quantity clamped to ${a.newQuantity}` }
              else if (a.type === 'price') { icon = '💲'; color = '#2563eb'; text = `Price changed ${a.oldPrice} → ${a.newPrice}` }
              else if (a.type === 'error') { icon = '⚠️'; color = '#dc2626'; text = `Validation failed (${a.reason || 'Unknown'})` }
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
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} disabled={validating}>
          <Text style={styles.primaryText}>{validating ? 'Validating…' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn,{marginTop:12}]} onPress={() => { clearCart(); router.back() }} disabled={validating}>
          <Text style={styles.secondaryText}>Clear & Close</Text></TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f9fafb', padding:24, paddingTop:48 },
  title: { fontSize:22, fontWeight:'700', color:'#111827' },
  desc: { fontSize:14, color:'#374151', marginTop:8 },
  meta: { fontSize:12, color:'#6b7280', marginTop:8 },
  adjustTitle: { fontSize:14, fontWeight:'700', color:'#111827', marginBottom:6 },
  adjustLine: { fontSize:12, color:'#374151', marginTop:2 },
  primaryBtn: { backgroundColor:'#16a34a', paddingVertical:14, borderRadius:12, alignItems:'center' },
  primaryText: { color:'#fff', fontWeight:'700', fontSize:15 },
  secondaryBtn: { backgroundColor:'#111827', paddingVertical:14, borderRadius:12, alignItems:'center' },
  secondaryText: { color:'#fff', fontWeight:'600', fontSize:13 },
  bannerWarning: { backgroundColor:'#fef3c7', borderRadius:12, padding:12, marginTop:12, borderWidth:1, borderColor:'#fde68a' },
  bannerText: { fontSize:12, color:'#92400e', fontWeight:'600' },
  bannerActions: { flexDirection:'row', marginTop:8, justifyContent:'flex-end' },
  bannerBtn: { paddingVertical:6, paddingHorizontal:12, borderRadius:8, backgroundColor:'#fff', borderWidth:1, borderColor:'#e5e7eb', marginLeft:8 },
  bannerBtnPrimary: { backgroundColor:'#2563eb', borderColor:'#2563eb' },
  bannerBtnText: { fontSize:12, fontWeight:'600', color:'#374151' },
  adjustRow: { flexDirection:'row', alignItems:'flex-start', marginBottom:6 },
  adjustIcon: { width:20, textAlign:'center' },
  actionsBar: { marginTop:12 },
})
