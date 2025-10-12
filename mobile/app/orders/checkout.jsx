import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useCart } from '../../context/cart'
import { useEffect, useState, useCallback } from 'react'
import { validateCartItems } from '../../utils/cartValidation'
import { checkoutStyles as styles } from '../../assets/styles/orders.styles'
import { COLORS } from '../../constants/colors'

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
          <ActivityIndicator size='small' color={COLORS.primary} />
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
            <TouchableOpacity onPress={applyAllPriceChanges} style={[styles.bannerBtn, styles.bannerBtnPrimary]}><Text style={[styles.bannerBtnText,{color: COLORS.white}]}>Apply All</Text></TouchableOpacity>
          </View>
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
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} disabled={validating}>
          <Text style={styles.primaryText}>{validating ? 'Validating…' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn,{marginTop:12}]} onPress={() => { clearCart(); router.back() }} disabled={validating}>
          <Text style={styles.secondaryText}>Clear & Close</Text></TouchableOpacity>
      </View>
    </View>
  )
}
