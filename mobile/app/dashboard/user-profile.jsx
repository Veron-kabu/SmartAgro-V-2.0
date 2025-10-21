import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Image, ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { getJSON } from '../../context/api'
import SafeScreen from '../../components/SafeScreen'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
import StarRating from '../../components/StarRating'
import { ratingToCategory } from '../../utils/reviews'
import ProductCard from '../../components/ProductCard'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function UserProfile() {
  const { id } = useLocalSearchParams()
  const [user, setUser] = useState(null)
  const [reviews, setReviews] = useState([])
  const [otherProducts, setOtherProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { productId } = useLocalSearchParams()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [u, r, prods] = await Promise.all([
          getJSON(`/api/users/${id}`),
          productId ? getJSON(`/api/products/${productId}/reviews?include=comments`) : getJSON(`/api/users/${id}/reviews?include=comments`),
          getJSON(`/api/users/${id}/products?status=active`),
        ])
        if (mounted) {
          setUser(u)
          setReviews(r?.items || [])
          setOtherProducts(prods?.items || [])
        }
  } catch (_e) { setError('Failed to load user') } finally { setLoading(false) }
    })()
    return () => { mounted = false }
  }, [id, productId])

  const [bannerUrl] = useResolvedUrls(useMemo(() => user?.banner_image_url ? [user.banner_image_url] : [], [user?.banner_image_url]))
  const [profileUrl] = useResolvedUrls(useMemo(() => user?.profile_image_url ? [user.profile_image_url] : [], [user?.profile_image_url]))

  // Avoid initial flash of empty placeholders: show a single skeleton until user and content resolve at least once.
  if (loading && !user && reviews.length === 0 && otherProducts.length === 0) {
    return (
      <SafeScreen>
        <LoadingSpinner message="Loading profile..." />
      </SafeScreen>
    )
  }

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: '#f3f4f6', flexGrow: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>Profile</Text>
        {error ? (
          <Text style={{ color: '#dc2626', marginTop: 8 }}>{error}</Text>
        ) : null}

        {user ? (
          <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={{ width: '100%', height: 140 }} />
            ) : null}
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {profileUrl ? (
                <Image source={{ uri: profileUrl }} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5e7eb' }} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700' }}>{user?.full_name || user?.username || `User #${user?.id}`}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <StarRating value={user?.rating_avg || 0} />
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>({user?.rating_count || 0})</Text>
                </View>
                {user?.is_trusted ? (
                  <View style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#ecfeff', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 }}>
                    <Text style={{ color: '#0ea5e9', fontWeight: '700', fontSize: 12 }}>Trusted</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {user?.location ? (
                <Text style={{ marginTop: 8, color: '#374151' }}>Location: {typeof user.location === 'string' ? user.location : JSON.stringify(user.location)}</Text>
              ) : null}
              <Text style={{ marginTop: 8, color: '#6b7280' }}>Joined: {user?.created_at ? new Date(user.created_at).toLocaleString() : '—'}</Text>
            </View>
          </View>
        ) : null}

        {/* Reviews (product-specific if productId provided, otherwise all reviews about this seller) */}
        {Array.isArray(reviews) ? (
          <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ fontWeight: '700' }}>{productId ? 'Reviews for this product' : 'Reviews'}</Text>
            </View>
            {reviews.length ? reviews.map(r => (
              <View key={r.id} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <StarRating value={r.rating || 0} size={16} />
                  <Text style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>{ratingToCategory(r.rating).label}</Text>
                </View>
                {r.comment ? <Text style={{ marginTop: 6, color: '#374151' }}>{r.comment}</Text> : null}
                <Text style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>{new Date(r.createdAt).toLocaleString()}</Text>
                {/* Render full comment thread, oldest-first */}
                {Array.isArray(r.comments) && r.comments.length ? (
                  <View style={{ marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#e5e7eb' }}>
                    {r.comments.map(c => (
                      <View key={c.id} style={{ marginBottom: 8 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>
                          {c.authorName || c.authorUsername || 'User'} • {new Date(c.createdAt).toLocaleString()}
                        </Text>
                        <Text style={{ color: '#374151', marginTop: 2 }}>{c.comment}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )) : (
              <View style={{ padding: 16 }}>
                <Text style={{ color: '#6b7280' }}>No reviews yet.</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Other products from this seller */}
        {Array.isArray(otherProducts) ? (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>More from this seller</Text>
            {otherProducts.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {otherProducts.map(p => (
                  <View key={p.id} style={{ width: '48%', marginBottom: 12 }}>
                    <ProductCard product={p} />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: '#6b7280' }}>No other products.</Text>
            )}
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeScreen>
  )
}
