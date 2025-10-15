import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, Share, Dimensions, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getJSON } from '../../context/api'
import { useFavorites } from '../../context/favorites'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
import BlurhashImage from '../../components/BlurhashImage'
import Shimmer from '../../components/Shimmer'
import { useCart } from '../../context/cart'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'
import { BackButton } from '../../components/navigation'
import { productDetailStyles as styles } from '../../assets/styles/products.styles'
import { COLORS } from '../../constants/colors'

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
  const resolvedImages = useResolvedUrls(product?.images || [])

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
    // Include primary image so it renders in cart list
    const primaryImage = Array.isArray(product.images) && product.images.length ? product.images[0] : undefined
    addItem({ id: product.id, title: product.title, price: Number(product.price)||0, unit: product.unit, farmerId: product.farmerId, images: product.images || (primaryImage ? [primaryImage] : []), imageUrl: primaryImage }, qty)
    Alert.alert('Added', 'Product added to cart')
  }

  const toggleFavorite = async () => {
    if (!numericId) return
    try {
      const snapshot = product ? {
        title: product.title,
        price: product.price,
        unit: product.unit,
        images: product.images,
        imageBlurhashes: product.imageBlurhashes,
        location: product.location,
        quantityAvailable: product.quantityAvailable,
        status: product.status,
        farmerId: product.farmerId,
        isOrganic: product.isOrganic,
        description: product.description,
      } : undefined
      const updated = await toggleFavCtx(numericId, snapshot)
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
  const imgs = (resolvedImages && resolvedImages.length > 0) ? resolvedImages : (product?.images || [])
  if (!imgs.length) return <View style={[styles.heroImage, { backgroundColor: COLORS.divider }]} />
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
            <BackButton 
              color={COLORS.text}
              size={20}
              style={styles.navBtn}
              fallbackRoute="/home"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.circleBtn, (favorited || isFavorited(numericId)) && styles.circleBtnActive]} onPress={toggleFavorite} disabled={checkingFav}>
                <Ionicons name={(favorited || isFavorited(numericId)) ? 'heart' : 'heart-outline'} size={18} color={(favorited || isFavorited(numericId)) ? COLORS.white : COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleBtn} onPress={shareProduct}>
                <Ionicons name="share-social-outline" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>
          {product?.discountPercent > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: COLORS.warningText }]}><Text style={styles.discountBadgeText}>-{product.discountPercent}%</Text></View>
          )}
          {product?.isOrganic && (
            <View style={[styles.discountBadgeSecondary]}><Text style={styles.discountBadgeSecondaryText}>ORGANIC</Text></View>
          )}
        </View>

        {error ? (
          <View style={{ padding: 16, alignItems:'center' }}>
            <Text style={{ color: COLORS.error, marginBottom:12 }}>{error}</Text>
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
                let bg = COLORS.inputBackground; let fg = COLORS.text
                if (status && status !== 'active') {
                  if (status === 'sold') { label='Sold'; bg=COLORS.errorLight; fg=COLORS.error }
                  else if (status === 'expired') { label='Expired'; bg=COLORS.divider; fg=COLORS.text }
                  else if (status === 'inactive') { label='Inactive'; bg=COLORS.errorLight; fg=COLORS.warning }
                  else { label = status }
                }
                if (qty === 0) { label='Out of Stock'; bg=COLORS.errorLight; fg=COLORS.error }
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
