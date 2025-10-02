import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Share, Dimensions, Image } from 'react-native'
import { getJSON } from '../../context/api'
import { useFavorites } from '../../context/favorites'
import BlurhashImage from '../../components/BlurhashImage'
import Shimmer from '../../components/Shimmer'
import { useCart } from '../../context/cart'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'

export default function ProductDetail() {
  const { id } = useLocalSearchParams()
  const numericId = Number(Array.isArray(id) ? id[0] : id)
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qty, setQty] = useState(1)
  const [favorited, setFavorited] = useState(false)
  const [checkingFav, setCheckingFav] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const screenWidth = Dimensions.get('window').width
  const { addItem } = useCart()
  const { toggleFavorite: toggleFavCtx, isFavorited } = useFavorites()

  const load = useCallback(async () => {
    if (!numericId || isNaN(numericId)) {
      setError('Invalid product id')
      setLoading(false)
      return
    }
    setLoading(true); setError('')
    try {
      const data = await getJSON(`/api/products/${numericId}`)
      setProduct(data)
      // Check favorite status
      try {
        setCheckingFav(true)
        const fav = await getJSON(`/api/favorites/${numericId}/status`)
        setFavorited(!!fav?.favorited)
      } catch { /* ignore */ } finally { setCheckingFav(false) }
    } catch (_e) {
      setError(_e?.message || 'Failed to load product')
    } finally { setLoading(false) }
  }, [numericId])

  useEffect(() => { load() }, [load])

  const inc = () => setQty(q => Math.min(q + 1, Number(product?.quantityAvailable) || 999))
  const dec = () => setQty(q => Math.max(1, q - 1))
  const addToCart = () => {
    if (!product) return
    if (product.quantityAvailable <= 0) return
    addItem({ id: product.id, title: product.title, price: Number(product.price)||0, unit: product.unit, farmerId: product.farmerId }, qty)
    Alert.alert('Added', 'Product added to cart')
  }

  const toggleFavorite = async () => {
    if (!numericId) return
    try {
      const updated = await toggleFavCtx(numericId)
      setFavorited(updated)
      track(ANALYTICS_EVENTS.PRODUCT_FAVORITE_TOGGLED, { productId: numericId, favorited: updated })
    } catch (_e) {
      Alert.alert('Error', 'Could not update favorite')
    }
  }

  const shareProduct = async () => {
    if (!product) return
    try {
      await Share.share({
        title: product.title,
        message: `${product.title} - ${product.description || ''}\nPrice: $${Number(product.price).toFixed(2)}\n`,
      })
  track(ANALYTICS_EVENTS.PRODUCT_SHARED, { productId: product.id })
    } catch { /* ignore */ }
  }

  const headerCarousel = () => {
    const imgs = product?.images || []
    if (!imgs.length) return <View style={[styles.heroImage, { backgroundColor: '#d1d5db' }]} />
    return (
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex:1 }}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x
          const i = Math.round(x / screenWidth)
          if (i !== carouselIndex) setCarouselIndex(i)
        }}
        scrollEventThrottle={16}
      >
        {imgs.map((url, idx) => {
          // Prefetch next image for smoother swipe
          if (idx === carouselIndex && imgs[idx+1]) { Image.prefetch(imgs[idx+1]).catch(()=>{}) }
          return (
            <BlurhashImage
              key={idx}
              uri={url}
              blurhash={product?.imageBlurhashes?.[idx]}
              style={[styles.heroImage, { width: screenWidth }]}
              contentFit="cover"
            />
          )
        })}
      </ScrollView>
    )
  }

  // Safely format location which may be a string or object { name?, lat, lng }
  const formatLocation = (loc) => {
    if (!loc) return 'Unknown'
    if (typeof loc === 'string') return loc
    if (typeof loc === 'object') {
      if (loc.name && typeof loc.name === 'string') return loc.name
      if (loc.lat && loc.lng) return `${loc.lat}, ${loc.lng}`
    }
    return 'Unknown'
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Shimmer style={{ flex:1 }} />
        </View>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {headerCarousel()}
          {Array.isArray(product?.images) && product.images.length > 1 && (
            <View style={styles.dotsWrap}>
              {product.images.map((_,i)=>(
                <View key={i} style={[styles.dot, carouselIndex===i && styles.dotActive]} />
              ))}
            </View>
          )}
          <View style={styles.topButtons}>
            <TouchableOpacity style={styles.navBtn} onPress={() => router.back()}><Text style={styles.navBtnText}>{'<'}</Text></TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.circleBtn, (favorited || isFavorited(numericId)) && styles.circleBtnActive]} onPress={toggleFavorite} disabled={checkingFav}>
                <Text style={[styles.circleBtnText, (favorited || isFavorited(numericId)) && styles.circleBtnTextActive]}>{(favorited || isFavorited(numericId)) ? '★' : '☆'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleBtn} onPress={shareProduct}><Text style={styles.circleBtnText}>↗</Text></TouchableOpacity>
            </View>
          </View>
          {product?.discountPercent > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: '#111827' }]}><Text style={styles.discountBadgeText}>-{product.discountPercent}%</Text></View>
          )}
          {product?.isOrganic && (
            <View style={[styles.discountBadgeSecondary]}><Text style={styles.discountBadgeSecondaryText}>ORGANIC</Text></View>
          )}
        </View>

        {error ? (
          <View style={{ padding: 16, alignItems:'center' }}>
            <Text style={{ color: '#dc2626', marginBottom:12 }}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity>
          </View>
        ) : !product ? null : (
          <View style={styles.sheet}>
            <View style={{ flexDirection:'row', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <Text style={styles.title}>{product.title}</Text>
              {(() => {
                const status = (product.status || '').toLowerCase()
                const qty = Number(product.quantityAvailable||0)
                let label = 'Active'
                let bg = '#dcfce7'; let fg = '#065f46'
                if (status && status !== 'active') {
                  if (status === 'sold') { label='Sold'; bg='#fee2e2'; fg='#991b1b' }
                  else if (status === 'expired') { label='Expired'; bg='#e5e7eb'; fg='#374151' }
                  else if (status === 'inactive') { label='Inactive'; bg='#fef3c7'; fg='#92400e' }
                  else { label = status }
                }
                if (qty === 0) { label='Out of Stock'; bg='#fee2e2'; fg='#991b1b' }
                return <Text style={{ backgroundColor:bg, color:fg, fontSize:10, fontWeight:'700', paddingHorizontal:10, paddingVertical:4, borderRadius:12 }}>{label}</Text>
              })()}
            </View>
            <View style={{ flexDirection:'row', alignItems:'flex-end', gap:8 }}>
              {product.discountPercent > 0 && (
                <Text style={styles.origPrice}>${Number(product.price).toFixed(2)}</Text>
              )}
              <Text style={styles.price}>${product.discountPercent > 0 ? (Number(product.price) * (1 - product.discountPercent/100)).toFixed(2) : Number(product.price).toFixed(2)} <Text style={styles.unit}>/ {product.unit || 'unit'}</Text></Text>
            </View>
            {typeof product.description === 'string' && product.description.trim().length > 0 && (
              <Text style={styles.desc}>{product.description}</Text>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Available:</Text>
              <Text style={styles.metaValue}>{product.quantityAvailable}</Text>
            </View>
            {product.minimumOrder && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Minimum order:</Text>
                <Text style={styles.metaValue}>{product.minimumOrder}</Text>
              </View>
            )}
            {product.location && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Location:</Text>
                <Text style={styles.metaValue}>{formatLocation(product.location)}</Text>
              </View>
            )}

            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Qty</Text>
              <View style={styles.qtyControls}>
                <TouchableOpacity onPress={dec} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                <Text style={styles.qtyValue}>{qty}</Text>
                <TouchableOpacity onPress={inc} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
              </View>
              <Text style={styles.extPrice}>${(Number(product.price) * qty).toFixed(2)}</Text>
            </View>

            <View style={{ flexDirection:'row', gap:12, marginTop:28 }}>
              <TouchableOpacity style={[styles.secondaryActionBtn]} onPress={() => router.push(`/dashboard/messages?to=${product.farmerId}`)} activeOpacity={0.85}>
                <Text style={styles.secondaryActionBtnText}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryActionBtn]} onPress={() => router.push(`/orders/new?product=${product.id}`)} activeOpacity={0.85}>
                <Text style={styles.secondaryActionBtnText}>Order Now</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.addBtn, product.quantityAvailable <= 0 && styles.addBtnDisabled]} onPress={addToCart} activeOpacity={0.85} disabled={product.quantityAvailable <= 0}>
              <Text style={styles.addBtnText}>{product.quantityAvailable <= 0 ? 'Out of stock' : 'Add to cart'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  heroWrap: { position: 'relative', width: '100%', height: 260, backgroundColor: '#e5e7eb' },
  heroImage: { width: '100%', height: '100%' },
  dotsWrap: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection:'row', justifyContent:'center', gap:6 },
  dot: { width:8, height:8, borderRadius:4, backgroundColor:'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor:'#fff' },
  topButtons: { position: 'absolute', top: 40, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navBtn: { backgroundColor: 'rgba(255,255,255,0.8)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  circleBtn: { backgroundColor: 'rgba(255,255,255,0.8)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  circleBtnText: { fontSize: 16, color: '#111827', fontWeight: '600' },
  discountBadge: { position: 'absolute', top: 40, left: 16, backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  discountBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  discountBadgeSecondary: { position: 'absolute', top: 40, right: 16, backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  discountBadgeSecondaryText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sheet: { marginTop: -28, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: 340 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 6 },
  price: { fontSize: 20, fontWeight: '700', color: '#111827' },
  origPrice: { fontSize: 14, color: '#6b7280', textDecorationLine:'line-through', fontWeight:'600', marginBottom:2 },
  unit: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  desc: { fontSize: 13, color: '#475569', marginTop: 10, lineHeight: 18 },
  metaRow: { flexDirection: 'row', marginTop: 8 },
  metaLabel: { fontSize: 12, color: '#6b7280', width: 110 },
  metaValue: { fontSize: 12, color: '#111827', fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22, gap: 16 },
  qtyLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 24, paddingHorizontal: 8, paddingVertical: 6 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  qtyValue: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#111827' },
  extPrice: { marginLeft: 'auto', fontSize: 14, fontWeight: '700', color: '#111827' },
  addBtn: { marginTop: 18, backgroundColor: '#111827', paddingVertical: 14, borderRadius: 32, alignItems: 'center' },
  addBtnDisabled: { backgroundColor: '#9ca3af' },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  circleBtnActive: { backgroundColor: '#111827' },
  circleBtnTextActive: { color: '#fff' },
  retryBtn: { backgroundColor: '#111827', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  secondaryActionBtn: { flex:1, backgroundColor: '#f1f5f9', paddingVertical: 14, borderRadius: 28, alignItems:'center' },
  secondaryActionBtnText: { color:'#111827', fontWeight:'700', fontSize:14 },
})
