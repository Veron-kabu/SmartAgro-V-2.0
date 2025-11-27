import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { useEffect, useState, useCallback, useMemo, useRef, useLayoutEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import { View, Text, TouchableOpacity, ScrollView, Alert, Share, Dimensions, Image, StyleSheet, TextInput, Keyboard } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getJSON, postJSON, deleteJSON } from '../../context/api'
import { useFavorites } from '../../context/favorites'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
import BlurhashImage from '../../components/BlurhashImage'
import Shimmer from '../../components/Shimmer'
import { useCart } from '../../context/cart'
import { track } from '../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../constants/analyticsEvents'
import { productDetailStyles as styles } from '../../assets/styles/products.styles'
import { COLORS } from '../../constants/colors'
import StarRating from '../../components/StarRating'
import { REVIEW_CATEGORIES, ratingToCategory } from '../../utils/reviews'
import { useProfile } from '../../context/profile'

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
  const [autoPlayPaused, setAutoPlayPaused] = useState(false)
  const autoPlayIntervalMs = 4000
  const isAutoScrollingRef = useRef(false)
  const screenWidth = Dimensions.get('window').width
  const { addItem, removeItem, items } = useCart()
  const { toggleFavorite: toggleFavCtx, isFavorited } = useFavorites()
  const resolvedImages = useResolvedUrls(product?.images || [])
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [submittingReview, setSubmittingReview] = useState(false)
  const { profile } = useProfile()
  const navigation = useNavigation()
  const isAdmin = String(profile?.role || '').toLowerCase() === 'admin'
  const isSuspended = String(profile?.status || '').toLowerCase() === 'suspended'
  const isOwner = profile?.role === 'farmer' && profile?.id === product?.farmerId
  const isVerified = profile?.farmVerified === true
  const scrollRef = useRef(null)
  const { refresh: refreshProfile } = useProfile()
  
  // Refresh profile when screen comes into focus (e.g., after verification)
  useFocusEffect(
    useCallback(() => {
      refreshProfile()
    }, [refreshProfile])
  )
  const imageCount = useMemo(() => (
    Array.isArray(resolvedImages) && resolvedImages.length > 0
      ? resolvedImages.length
      : (Array.isArray(product?.images) ? product.images.length : 0)
  ), [resolvedImages, product?.images])
  // Inline reply state
  const [openReply, setOpenReply] = useState(null) // reviewId that is open
  const [replyTextById, setReplyTextById] = useState({})
  const [commentsByReviewId, setCommentsByReviewId] = useState({}) // id -> array of comments (ascending)
  const [sendingReplyId, setSendingReplyId] = useState(null)
  const [loadingCommentsById, setLoadingCommentsById] = useState({})

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
      // Fetch product-specific reviews (strictly for this product)
      try {
        setLoadingReviews(true)
        const r = await getJSON(`/api/products/${numericId}/reviews`)
        setReviews(Array.isArray(r?.items) ? r.items : [])
      } catch { setReviews([]) } finally { setLoadingReviews(false) }
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
  const inCart = useMemo(() => !!(product && Array.isArray(items) && items.some(i => i.id === product.id)), [items, product])

  const addToCart = () => {
    if (!product) return
    if (product.quantityAvailable <= 0) return
    // Include primary image so it renders in cart list
    const primaryImage = Array.isArray(product.images) && product.images.length ? product.images[0] : undefined
    addItem({ id: product.id, title: product.title, price: Number(product.price)||0, unit: product.unit, farmerId: product.farmerId, images: product.images || (primaryImage ? [primaryImage] : []), imageUrl: primaryImage, discountPercent: Number(product.discountPercent||0) }, qty)
    Alert.alert('Added', 'Product added to cart')
  }

  const removeFromCart = () => {
    if (!product) return
    removeItem(product.id)
    Alert.alert('Removed', 'Product removed from cart')
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
        farmerEmail: product.farmerEmail,
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
      const unit = product.unit || 'unit'
      const discounted = (Number(product?.discountPercent) > 0)
        ? (Number(product.price) * (1 - Number(product.discountPercent)/100))
        : Number(product.price)
      await Share.share({
        title: product.title,
        message: `${product.title} - ${product.description || ''}\nPrice: Ksh ${discounted.toFixed(2)} / ${unit}\n`,
      })
  track(ANALYTICS_EVENTS.PRODUCT_SHARED, { productId: product.id })
    } catch { /* ignore */ }
  }

  // Hide native header and use an in-page header for easier control
  useLayoutEffect(() => {
    try { navigation.setOptions({ headerShown: false }) } catch (_e) {}
  }, [navigation])

  const submitReview = async () => {
    Keyboard.dismiss()
    if (!product) return
    if (myRating < 1 || myRating > 5) return Alert.alert('Rating required', 'Please select 1-5 stars')
    try {
      setSubmittingReview(true)
      await postJSON('/api/reviews', { product_id: product.id, rating: myRating, comment: myComment || null })
      Alert.alert('Thanks!', 'Your review has been submitted')
      setMyRating(0); setMyComment('')
      // Reload reviews
      try {
        const r = await getJSON(`/api/products/${product.id}/reviews`)
        setReviews(Array.isArray(r?.items) ? r.items : [])
      } catch {}
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not submit review')
    } finally { setSubmittingReview(false) }
  }

  const loadComments = useCallback(async (reviewId) => {
    if (!reviewId) return
    setLoadingCommentsById(prev => ({ ...prev, [reviewId]: true }))
    try {
      const c = await getJSON(`/api/reviews/${reviewId}/comments`)
      // Server returns newest-first; show oldest-first so new ones appear below prior comments
      const list = Array.isArray(c?.items) ? [...c.items].reverse() : []
      setCommentsByReviewId(prev => ({ ...prev, [reviewId]: list }))
    } catch {
      setCommentsByReviewId(prev => ({ ...prev, [reviewId]: [] }))
    } finally {
      setLoadingCommentsById(prev => ({ ...prev, [reviewId]: false }))
    }
  }, [])

  const toggleReply = useCallback((reviewId) => {
    setOpenReply(curr => {
      const next = curr === reviewId ? null : reviewId
      if (next && !Array.isArray(commentsByReviewId[reviewId])) {
        // Lazy-load comments on first open
        loadComments(reviewId)
      }
      return next
    })
  }, [commentsByReviewId, loadComments])

  const sendReply = useCallback(async (reviewId) => {
    const text = (replyTextById[reviewId] || '').trim()
    if (!text) return
    Keyboard.dismiss()
    // Optimistic append
    const optimistic = {
      id: `temp_${Date.now()}`,
      reviewId,
      authorUserId: profile?.id,
      authorName: null,
      authorUsername: profile?.username || null,
      comment: text,
      createdAt: new Date().toISOString(),
      optimistic: true,
    }
    setCommentsByReviewId(prev => {
      const list = Array.isArray(prev[reviewId]) ? prev[reviewId] : []
      return { ...prev, [reviewId]: [...list, optimistic] }
    })
    setReplyTextById(prev => ({ ...prev, [reviewId]: '' }))
    setSendingReplyId(reviewId)
    try {
      await postJSON(`/api/reviews/${reviewId}/comments`, { comment: text })
      // Re-fetch to replace optimistic with real identity/order
      await loadComments(reviewId)
    } catch (e) {
      // Revert optimistic on failure
      setCommentsByReviewId(prev => {
        const list = Array.isArray(prev[reviewId]) ? prev[reviewId] : []
        return { ...prev, [reviewId]: list.filter(c => c.id !== optimistic.id) }
      })
      Alert.alert('Error', e?.body || e?.message || 'Failed to send reply')
    } finally {
      setSendingReplyId(null)
    }
  }, [replyTextById, profile?.id, profile?.username, loadComments])

  const deleteReply = useCallback(async (reviewId, commentId) => {
    Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteJSON(`/api/admin/reviews/comments/${commentId}`)
          setCommentsByReviewId(prev => {
            const list = Array.isArray(prev[reviewId]) ? prev[reviewId] : []
            return { ...prev, [reviewId]: list.filter(c => c.id !== commentId) }
          })
        } catch (e) {
          Alert.alert('Error', e?.body || e?.message || 'Failed to delete comment')
        }
      } }
    ])
  }, [])

  const deleteReview = useCallback(async (reviewId) => {
    Alert.alert('Delete review', 'Are you sure you want to delete this review?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await postJSON(`/api/admin/reviews/${reviewId}`, { _method: 'DELETE' })
        } catch {
          // If server expects DELETE, fall back to fetch
          try { await fetch(`/api/admin/reviews/${reviewId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }) } catch {}
        } finally {
          setReviews(prev => prev.filter(r => r.id !== reviewId))
        }
      }}
    ])
  }, [])

  // Auto-play logic: advance carousel every autoPlayIntervalMs unless paused or user is interacting
  useEffect(() => {
    if (imageCount <= 1) return
    if (autoPlayPaused) return
    const id = setInterval(() => {
      setCarouselIndex(curr => {
        const total = imageCount
        const next = (curr + 1) % total
        return next
      })
    }, autoPlayIntervalMs)
    return () => clearInterval(id)
  }, [imageCount, autoPlayPaused])

  // Scroll to the active index when it changes (autoplay or dots tap)
  useEffect(() => {
    if (!scrollRef.current) return
    if (imageCount <= 1) return
    try {
      isAutoScrollingRef.current = true
      scrollRef.current.scrollTo({ x: carouselIndex * screenWidth, animated: true })
      // Fallback safety to clear flag in case momentum event doesn't fire
      setTimeout(() => { isAutoScrollingRef.current = false }, 600)
    } catch {
      isAutoScrollingRef.current = false
    }
  }, [carouselIndex, screenWidth, imageCount])

  const headerCarousel = () => {
  const imgs = (resolvedImages && resolvedImages.length > 0) ? resolvedImages : (product?.images || [])
  if (!imgs.length) return <View style={[styles.heroImage, { backgroundColor: COLORS.divider }]} />
    return (
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex:1 }}
        onScroll={(e) => {
          // Ignore index updates during programmatic auto-scroll to avoid jitter
          if (isAutoScrollingRef.current) return
        }}
        scrollEventThrottle={16}
        // When user touches, pause autoplay; resume shortly after release
        onTouchStart={() => setAutoPlayPaused(true)}
        onScrollBeginDrag={() => setAutoPlayPaused(true)}
        onMomentumScrollEnd={(e) => {
          // Update index to the nearest page after manual scroll or auto-scroll completes
          const x = e?.nativeEvent?.contentOffset?.x || 0
          const i = Math.round(x / screenWidth)
          if (Number.isFinite(i) && i !== carouselIndex) setCarouselIndex(i)
          // Clear auto-scrolling lock and resume autoplay after a short delay
          isAutoScrollingRef.current = false
          // Brief timeout to avoid immediate restart causing jank
          setTimeout(() => setAutoPlayPaused(false), 3000)
        }}
      >
        {imgs.map((url, idx) => {
          // Prefetch next image for smoother swipe
          if (idx === carouselIndex && imgs[idx+1]) { Image.prefetch(imgs[idx+1]).catch(()=>{}) }
          return (
            <BlurhashImage
              key={idx}
              uri={url}
              blurhash={product?.imageBlurhashes?.[idx]}
              style={[styles.heroImage, { width: screenWidth, height: 300 }]}
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

  // Local header styles for the in-page header
  const localHeaderStyles = StyleSheet.create({
    header: {
      height: 31,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      backgroundColor: COLORS.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    leftBtn: { padding: 6 },
    title: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginLeft: 38 },
    rightActions: { flexDirection: 'row', alignItems: 'center' },
  })

  return (
    <View style={styles.container}>
      {loading && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Shimmer style={{ flex:1 }} />
        </View>
      )}

      {/* In-page header: back, centered title, actions */}
      <View style={localHeaderStyles.header}>
        <TouchableOpacity onPress={() => router.back()} style={localHeaderStyles.leftBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={localHeaderStyles.title}>Product</Text>
        <View style={localHeaderStyles.rightActions}>
          {!isOwner && (
            <TouchableOpacity onPress={toggleFavorite} disabled={checkingFav} style={{ padding: 6, marginRight: 8 }}>
              <Ionicons name={(favorited || isFavorited(numericId)) ? 'heart' : 'heart-outline'} size={20} color={(favorited || isFavorited(numericId)) ? COLORS.primary : COLORS.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={shareProduct} style={{ padding: 6 }}>
            <Ionicons name="share-social-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.heroWrap}>
          {headerCarousel()}
          {imageCount > 1 && (
            <View style={styles.dotsWrap}>
              {Array.from({ length: imageCount }).map((_,i)=>(
                <View key={i} style={[styles.dot, carouselIndex===i && styles.dotActive]} />
              ))}
            </View>
          )}
          <View style={styles.topButtons} />
          {product?.discountPercent > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: COLORS.warningText }]}><Text style={styles.discountBadgeText}>-{product.discountPercent}%</Text></View>
          )}
          {product?.isOrganic && (
            <View style={[styles.discountBadgeSecondary]}><Text style={styles.discountBadgeSecondaryText}>ORGANIC</Text></View>
          )}
        </View>
        {/* Thumbnail strip below hero image (use resolvedImages or fall back to product.images) */}
        {(() => {
          const thumbs = (resolvedImages && resolvedImages.length > 0)
            ? resolvedImages
            : (Array.isArray(product?.images) ? product.images : [])
          if (!Array.isArray(thumbs) || thumbs.length === 0) return null
          return (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}
            >
              {thumbs.map((url, idx) => {
                // support objects with { url } as well as raw string urls
                const uri = (url && typeof url === 'object' && url.url) ? url.url : (typeof url === 'string' ? url : undefined)
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setCarouselIndex(idx)
                      try { scrollRef.current?.scrollTo({ x: idx * screenWidth, animated: true }) } catch {}
                    }}
                    style={{ marginRight: 8 }}
                  >
                    {uri ? (
                      <Image
                        source={{ uri }}
                        style={{ width: 68, height: 68, borderRadius: 8, borderWidth: carouselIndex === idx ? 2 : 1, borderColor: carouselIndex === idx ? COLORS.primary : COLORS.border }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ width: 68, height: 68, borderRadius: 8, backgroundColor: COLORS.divider }} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )
        })()}

        {error ? (
          <View style={{ padding: 16, alignItems:'center' }}>
            <Text style={{ color: COLORS.error, marginBottom:12 }}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity>
          </View>
        ) : !product ? null : (
          <View style={styles.sheet}>
            {/* Title */}
            <Text style={styles.title}>{product.title}</Text>

            {/* Price row: price left, unit (e.g. "per bag") aligned right */}
            <View style={{ flexDirection:'row', alignItems:'flex-end', justifyContent:'space-between', marginTop: 4 }}>
              <View style={{ flexDirection:'row', alignItems:'flex-end', gap:8 }}>
                {product.discountPercent > 0 && (
                  <Text style={styles.origPrice}>Ksh{Number(product.price).toFixed(2)}</Text>
                )}
                <Text style={styles.price}>Ksh{product.discountPercent > 0 ? (Number(product.price) * (1 - product.discountPercent/100)).toFixed(2) : Number(product.price).toFixed(2)}</Text>
              </View>
              <Text style={[styles.unit, { textAlign: 'right' }]}>{product.unit ? `per ${product.unit}` : ''}</Text>
            </View>

            {/* Rating */}
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {(() => {
                const count = Array.isArray(reviews) ? reviews.length : 0
                const avg = count ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / count) : 0
                return (
                  <>
                    <StarRating value={avg} max={5} size={16} />
                    <Text style={{ color: COLORS.textLight, fontSize: 12 }}>{avg.toFixed(1)} ({count} review{count===1?'':'s'})</Text>
                  </>
                )
              })()}
            </View>

            {/* Availability */}
            <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginTop: 8 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <Ionicons name="cart" size={16} color={COLORS.primary} />
                <Text style={{ color: COLORS.text, fontWeight:'700' }}>{product.quantityAvailable} in stock</Text>
              </View>
            </View>

            {/* Location (moved above Key Features) */}
            {product.location && (
              <View style={{ marginTop: 12, flexDirection:'row', alignItems:'center', gap:6 }}>
                <Ionicons name="location" size={14} color={COLORS.textLight} />
                <Text style={{ color: COLORS.textLight }}>{formatLocation(product.location)}</Text>
              </View>
            )}

            {/* Key Features */}
            {(() => {
              // Prefer explicit features, fallback to extracting first bullet-like lines from description
              const features = Array.isArray(product?.features) && product.features.length > 0
                ? product.features
                : (Array.isArray(product?.keyFeatures) && product.keyFeatures.length > 0 ? product.keyFeatures : null)
              let derived = features
              if (!derived && typeof product.description === 'string') {
                const lines = product.description.split('\n').map(l => l.trim()).filter(Boolean)
                if (lines.length > 1) derived = lines.slice(0, 5)
              }
              if (!derived) return null
              return (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.sectionTitle}>Key Features</Text>
                    <View style={{ gap: 10 }}>
                    {derived.map((f, i) => (
                      <View key={i} style={{ flexDirection:'row', alignItems:'flex-start', gap:10 }}>
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
                        <Text style={{ color: COLORS.textLight, flex: 1 }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )
            })()}

            {/* Description */}
            {typeof product.description === 'string' && product.description.trim().length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.desc}>{product.description}</Text>
              </View>
            )}

            {/* Quantity controls + action buttons (below description) */}
            <View style={{ marginTop: 16 }}>
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Quantity</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                  <TouchableOpacity onPress={dec} style={styles.qtyBtn} accessibilityLabel="Decrease quantity">
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{qty}</Text>
                  <TouchableOpacity onPress={inc} style={styles.qtyBtn} accessibilityLabel="Increase quantity">
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ marginLeft: 12, color: COLORS.textLight }}>Minimum order: {product.minimumOrder || 1}</Text>
              </View>

              <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
                <TouchableOpacity
                  onPress={() => { if (inCart) { removeFromCart() } else { addToCart() } }}
                  disabled={product.quantityAvailable <= 0}
                  style={[styles.secondaryActionBtn, { flex: 1 }, (product.quantityAvailable <= 0) && { opacity: 0.6 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={inCart ? 'trash' : 'cart'} size={16} color={COLORS.text} style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryActionBtnText}>{inCart ? 'Remove from cart' : 'Add to cart'}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    try {
                      // Navigate to new order page with product id and qty
                      router.push({ pathname: '/orders/new', params: { product: String(product.id), qty: String(qty) } })
                    } catch (_e) {
                      // Fallback: add to cart then go to cart
                      await addToCart()
                      try { router.push('/cart') } catch {}
                    }
                  }}
                  disabled={product.quantityAvailable <= 0}
                  style={[styles.addBtn, { flex: 1 }, (product.quantityAvailable <= 0) && { opacity: 0.6 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="cart" size={16} color={styles.addBtnText?.color || COLORS.white} style={{ marginRight: 8 }} />
                    <Text style={styles.addBtnText}>Order Now</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Reviews Section */}
            <View style={{ marginTop: 28 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Reviews</Text>
              {/* Category filter */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
                {REVIEW_CATEGORIES.map((c) => {
                  const active = selectedCategory === c.key
                  return (
                    <TouchableOpacity key={c.key} onPress={() => setSelectedCategory(c.key)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, marginRight: 8, marginBottom: 8, backgroundColor: active ? '#eef2ff' : '#f3f4f6', borderWidth: active ? 1 : 0, borderColor: active ? '#6366f1' : 'transparent' }}>
                      <Text style={{ color: active ? '#3730a3' : '#374151', fontWeight: active ? '700' : '500' }}>{c.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {loadingReviews ? (
                <Text style={{ color: COLORS.muted }}>Loading reviews…</Text>
              ) : (Array.isArray(reviews) && reviews.length > 0) ? (
                <View style={{ gap: 12 }}>
                  {reviews
                    .filter((rv) => {
                      if (selectedCategory === 'All') return true
                      const cat = ratingToCategory(rv.rating)
                      return cat.key === selectedCategory
                    })
                    .slice(0, 6)
                    .map((rv) => (
                      <View key={rv.id} style={{ paddingVertical: 8, borderBottomColor: COLORS.divider, borderBottomWidth: StyleSheet.hairlineWidth }}>
                        <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>
                          by {profile?.id && rv.reviewerId === profile.id ? 'me' : (rv.reviewerName || rv.reviewerUsername || 'user')}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <StarRating value={rv.rating} size={14} />
                          <Text style={{ marginLeft: 4, fontSize: 12, color: '#6b7280' }}>{ratingToCategory(rv.rating).label}</Text>
                          <Text style={{ color: COLORS.text, fontSize: 12, marginLeft: 'auto' }}>{new Date(rv.createdAt).toLocaleDateString()}</Text>
                        </View>
                        {rv.comment && <Text style={{ color: COLORS.text, marginTop: 4 }}>{rv.comment}</Text>}
                        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                          <TouchableOpacity onPress={() => toggleReply(rv.id)}>
                            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>{openReply === rv.id ? 'Hide replies' : `Reply${(commentsByReviewId[rv.id]?.length ?? rv.commentsCount) > 0 ? ` · ${commentsByReviewId[rv.id]?.length ?? rv.commentsCount}` : ''}`}</Text>
                          </TouchableOpacity>
                          {profile?.role === 'admin' && (
                            <TouchableOpacity onPress={() => deleteReview(rv.id)}>
                              <Text style={{ color: COLORS.error, fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {openReply === rv.id && (
                          <View style={{ marginTop: 8 }}>
                            {/* Existing comments (oldest first) */}
                            {loadingCommentsById[rv.id] ? (
                              <Text style={{ color: COLORS.muted }}>Loading replies…</Text>
                            ) : (
                              Array.isArray(commentsByReviewId[rv.id]) && commentsByReviewId[rv.id].length > 0 ? (
                                <View style={{ gap: 8 }}>
                                  {commentsByReviewId[rv.id].map(c => {
                                    const isMe = !!profile?.id && c.authorUserId === profile.id
                                    const isOwner = !!product?.farmerId && c.authorUserId === product.farmerId
                                    const bg = isMe ? '#e6f9f2' : isOwner ? '#eef2ff' : '#fff'
                                    const bd = isMe ? '#34d399' : isOwner ? '#93c5fd' : COLORS.divider
                                    const name = isMe ? 'me' : (isOwner ? 'owner' : (c.authorName || c.authorUsername || `#${c.authorUserId}`))
                                    return (
                                      <View key={c.id} style={{ backgroundColor: bg, borderWidth: 1, borderColor: bd, borderRadius: 8, padding: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <Text style={{ color: COLORS.muted, fontSize: 11, marginBottom: 2, flex: 1 }}>by {name}</Text>
                                          {isAdmin && (
                                            <TouchableOpacity onPress={() => deleteReply(rv.id, c.id)}>
                                              <Text style={{ color: COLORS.error, fontWeight: '700' }}>Delete</Text>
                                            </TouchableOpacity>
                                          )}
                                        </View>
                                        <Text style={{ color: COLORS.text }}>{c.comment}</Text>
                                        <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 4 }}>{new Date(c.createdAt).toLocaleString()}</Text>
                                      </View>
                                    )
                                  })}
                                </View>
                              ) : (
                                <Text style={{ color: COLORS.muted }}>No replies yet.</Text>
                              )
                            )}
                            {/* Reply input */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                              <TextInput
                                placeholder="Write a reply"
                                placeholderTextColor={COLORS.messageInputPlaceholder}
                                value={replyTextById[rv.id] || ''}
                                onChangeText={(t) => setReplyTextById(prev => ({ ...prev, [rv.id]: t }))}
                                editable={!isSuspended}
                                style={{ flex: 1, backgroundColor: COLORS.inputBackground, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, opacity: isSuspended ? 0.6 : 1 }}
                                multiline
                              />
                              <TouchableOpacity
                                onPress={() => sendReply(rv.id)}
                                disabled={sendingReplyId === rv.id || !String(replyTextById[rv.id] || '').trim() || isSuspended}
                                style={{ backgroundColor: (!String(replyTextById[rv.id] || '').trim() || isSuspended) ? COLORS.divider : COLORS.primary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 }}
                              >
                                <Text style={{ color: COLORS.white, fontWeight: '700' }}>{sendingReplyId === rv.id ? 'Sending…' : 'Send'}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    ))}
                  {reviews.length > 6 && (
                    <Text style={{ color: COLORS.muted, fontSize: 12 }}>And {reviews.length - 6} more…</Text>
                  )}
                </View>
              ) : (
                <Text style={{ color: COLORS.muted }}>No reviews yet</Text>
              )}

              {/* Write a review */}
              <View style={{ marginTop: 16, padding: 12, borderWidth: 2, borderColor: COLORS.border, borderRadius: 10 }}>
                <Text style={{ color: COLORS.text, marginBottom: 8, fontWeight: '600' }}>Rate this seller</Text>
                <StarRating value={myRating} editable={!isSuspended} onChange={setMyRating} />
                <TextInput
                  placeholder="Optional comment"
                  placeholderTextColor={COLORS.messageInputPlaceholder}
                  value={myComment}
                  onChangeText={setMyComment}
                  editable={!isSuspended}
                  style={{ marginTop: 8, backgroundColor: COLORS.inputBackground, padding: 10, borderRadius: 8, color: COLORS.text, opacity: isSuspended ? 0.6 : 1, borderWidth: 2, borderColor: COLORS.online }}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!isVerified) {
                      Alert.alert('Verification Required', 'You must be verified to submit reviews. Please complete the verification process.')
                      return
                    }
                    submitReview()
                  }}
                  disabled={submittingReview || myRating < 1 || isSuspended || !isVerified}
                  style={{ marginTop: 10, backgroundColor: (myRating < 1 || isSuspended || !isVerified) ? COLORS.divider : COLORS.primary, paddingVertical: 10, borderRadius: 6, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.white, fontWeight: '700' }}>{submittingReview ? 'Submitting…' : (!isVerified ? 'Verification required' : 'Submit review')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
