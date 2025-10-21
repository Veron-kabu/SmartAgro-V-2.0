import { useLocalSearchParams, router } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
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
import { BackButton } from '../../components/navigation'
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
  const screenWidth = Dimensions.get('window').width
  const { addItem } = useCart()
  const { toggleFavorite: toggleFavCtx, isFavorited } = useFavorites()
  const resolvedImages = useResolvedUrls(product?.images || [])
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [submittingReview, setSubmittingReview] = useState(false)
  const { profile } = useProfile()
  const isAdmin = String(profile?.role || '').toLowerCase() === 'admin'
  const isSuspended = String(profile?.status || '').toLowerCase() === 'suspended'
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
      // Fetch seller reviews
      try {
        if (data?.farmerId) {
          setLoadingReviews(true)
          const r = await getJSON(`/api/users/${data.farmerId}/reviews`)
          setReviews(Array.isArray(r?.items) ? r.items : [])
        } else { setReviews([]) }
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
      await Share.share({
        title: product.title,
        message: `${product.title} - ${product.description || ''}\nPrice: $${Number(product.price).toFixed(2)}\n`,
      })
  track(ANALYTICS_EVENTS.PRODUCT_SHARED, { productId: product.id })
    } catch { /* ignore */ }
  }

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
        const r = await getJSON(`/api/users/${product.farmerId}/reviews`)
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
  <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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
            {/* Seller rating summary */}
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <StarRating value={Number(product.farmerRatingAvg || 0)} max={5} size={16} />
              <Text style={{ color: COLORS.text, fontSize: 12 }}>
                {Number(product.farmerRatingAvg || 0).toFixed(1)} ({Number(product.farmerRatingCount || 0)} reviews)
              </Text>
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

            {(!profile?.id || profile.id !== product.farmerId) && (
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Qty</Text>
                <View style={styles.qtyControls}>
                  <TouchableOpacity onPress={dec} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                  <Text style={styles.qtyValue}>{qty}</Text>
                  <TouchableOpacity onPress={inc} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                </View>
                <Text style={styles.extPrice}>${(Number(product.price) * qty).toFixed(2)}</Text>
              </View>
            )}

            {(!profile?.id || profile.id !== product.farmerId) && (
              <>
                <View style={{ flexDirection:'row', gap:12, marginTop:28 }}>
                  <TouchableOpacity style={[styles.secondaryActionBtn, isSuspended && { opacity: 0.5 }]} onPress={() => router.push(`/orders/new?product=${product.id}`)} disabled={isSuspended} activeOpacity={0.85}>
                    <Text style={styles.secondaryActionBtnText}>Order Now</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.addBtn, product.quantityAvailable <= 0 && styles.addBtnDisabled]} onPress={addToCart} activeOpacity={0.85} disabled={product.quantityAvailable <= 0}>
                  <Text style={styles.addBtnText}>{product.quantityAvailable <= 0 ? 'Out of stock' : 'Add to cart'}</Text>
                </TouchableOpacity>
              </>
            )}

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
                                <Text style={{ color: '#fff', fontWeight: '700' }}>{sendingReplyId === rv.id ? 'Sending…' : 'Send'}</Text>
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
              <View style={{ marginTop: 16, padding: 12, borderWidth: 1, borderColor: COLORS.divider, borderRadius: 8 }}>
                <Text style={{ color: COLORS.text, marginBottom: 8, fontWeight: '600' }}>Rate this seller</Text>
                <StarRating value={myRating} editable={!isSuspended} onChange={setMyRating} />
                <TextInput
                  placeholder="Optional comment"
                  value={myComment}
                  onChangeText={setMyComment}
                  editable={!isSuspended}
                  style={{ marginTop: 8, backgroundColor: COLORS.inputBackground, padding: 10, borderRadius: 6, color: COLORS.text, opacity: isSuspended ? 0.6 : 1 }}
                />
                <TouchableOpacity
                  onPress={submitReview}
                  disabled={submittingReview || myRating < 1 || isSuspended}
                  style={{ marginTop: 10, backgroundColor: (myRating < 1 || isSuspended) ? COLORS.divider : COLORS.primary, paddingVertical: 10, borderRadius: 6, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>{submittingReview ? 'Submitting…' : 'Submit review'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
