import { useEffect, useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, FlatList } from "react-native"
import { router } from 'expo-router'
import BlurhashImage from "../../components/BlurhashImage"
import { useResolvedUrls } from "../../hooks/useResolvedUrls"
import { useAuth } from "@clerk/clerk-expo"
import { useProfile } from "../../context/profile"
import { Ionicons } from "@expo/vector-icons"
import EmptyState from "../../components/EmptyState"
import { getJSON } from "../../context/api"
import { subscribeAppEvents } from "../../context/favorites"
import { homeStyles } from "../../assets/styles/(tabs)/home.styles"
import { productDetailStyles as pstyles } from '../../assets/styles/products.styles'
import { Image } from "expo-image"
import { COLORS } from "../../constants/colors"
import CategoryFilter from "../../components/CategoryFilter"
import { CATEGORIES as SHARED_CATEGORIES } from "../../constants/categories"
import ProductCard from "../../components/ProductCard"
import LoadingSpinner from "../../components/LoadingSpinner"

export default function MarketScreen() {
  const { isSignedIn } = useAuth()
  const { profile } = useProfile()
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [featuredProduct, setFeaturedProduct] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Resolve featured image URL (handles private S3)
  const resolvedFeatured = useResolvedUrls(featuredProduct?.images || [])

  const categories = SHARED_CATEGORIES

  const fetchProducts = async () => {
    try {
      const data = await getJSON(`/api/products`)
      const productList = data || []
      setProducts(productList)
      setFilteredProducts(productList)
      
      // Set a random product as featured (or the first one)
      if (productList.length > 0) {
        const randomIndex = Math.floor(Math.random() * productList.length)
        setFeaturedProduct(productList[randomIndex])
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isSignedIn) {
      fetchProducts()
    }
  }, [isSignedIn])

  // Real-time stock/status updates
  useEffect(() => {
    const unsub = subscribeAppEvents(evt => {
      if (evt.type === 'product:stockChanged') {
        const { productId, remaining, status } = evt.payload || {}
        if (!productId) return
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantityAvailable: typeof remaining === 'number' ? remaining : p.quantityAvailable, status: status || p.status } : p))
        setFilteredProducts(prev => prev.map(p => p.id === productId ? { ...p, quantityAvailable: typeof remaining === 'number' ? remaining : p.quantityAvailable, status: status || p.status } : p))
      } else if (evt.type === 'product:created') {
        const { productId, product } = evt.payload || {}
        if (!productId && !product?.id) return
        const id = productId || product.id
        // Prefer fetching full details to include farmer info
        ;(async () => {
          try {
            const full = await getJSON(`/api/products/${id}`)
            // Only insert if visible to buyers (active and in stock)
            if ((full?.status || 'active') === 'active' && Number(full?.quantityAvailable || 0) > 0) {
              setProducts(prev => {
                if (prev.some(p => p.id === id)) return prev
                return [full, ...prev]
              })
              // If we don't have a featured product, seed it
              setFeaturedProduct(fp => fp || full)
            }
          } catch (_) {
            // Fallback: insert the snapshot if provided and valid
            if (product && (product.status || 'active') === 'active' && Number(product.quantityAvailable || 0) > 0) {
              setProducts(prev => {
                if (prev.some(p => p.id === id)) return prev
                return [product, ...prev]
              })
              setFeaturedProduct(fp => fp || product)
            }
          }
        })()
      }
      else if (evt.type === 'product:updated') {
        const { productId, product } = evt.payload || {}
        const id = productId || product?.id
        if (!id) return
        setProducts(prev => {
          const exists = prev.some(p => p.id === id)
          // If product already in list, either update it (if still visible) or remove it (if now inactive/out of stock)
          if (exists) {
            return prev.reduce((acc, p) => {
              if (p.id !== id) { acc.push(p); return acc }
              // p.id === id
              if (product && (product.status || 'active') === 'active' && Number(product.quantityAvailable || 0) > 0) {
                acc.push(product)
              }
              return acc
            }, [])
          }
          // Not present: if product became active and in-stock, insert it at the top
          if (product && (product.status || 'active') === 'active' && Number(product.quantityAvailable || 0) > 0) {
            return [product, ...prev]
          }
          return prev
        })
        // Update featured product if it matches or seed if missing
        setFeaturedProduct(fp => {
          if (fp && fp.id === id) return (product || fp)
          if (!fp && product && (product.status || 'active') === 'active' && Number(product.quantityAvailable || 0) > 0) return product
          return fp
        })
      }
    })
    return () => { unsub && unsub() }
  }, [])

  // Derive filtered products with robust location handling (location may be object {lat,lng,...})
  useEffect(() => {
    let filtered = products

    if (selectedCategory) {
      filtered = filtered.filter((product) => product.category?.toLowerCase() === selectedCategory.toLowerCase())
    }

    setFilteredProducts(filtered)
  }, [products, selectedCategory])

  const onRefresh = () => {
    setRefreshing(true)
    fetchProducts()
  }

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading products..." />
  }

  return (
    <View style={homeStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={homeStyles.scrollContent}
      >
        {/* Animal Icons */}
        <View style={homeStyles.welcomeSection}>
          <Image
            source={require("../../assets/images/h2.png")}
            style={{
              width: 100,
              height: 100,
            }}
          />
          <Image
            source={require("../../assets/images/h1.png")}
            style={{
              width: 100,
              height: 100,
            }}
          />
          <Image
            source={require("../../assets/images/h3.png")}
            style={{
              width: 100,
              height: 100,
            }}
          />
        </View>
        
        {/* Featured Product */}
        {featuredProduct && (
          <View style={homeStyles.featuredSection}>
            <TouchableOpacity
              style={homeStyles.featuredCard}
              activeOpacity={0.9}
              onPress={() => {
                const isOwner = profile?.role === 'farmer' && profile?.id === featuredProduct.farmerId
                if (isOwner) {
                  router.push(`/products/edit/${featuredProduct.id}`)
                } else {
                  router.push(`/products/${featuredProduct.id}`)
                }
              }}
            >
              <View style={homeStyles.featuredImageContainer}>
                <BlurhashImage
                  uri={resolvedFeatured?.[0] || featuredProduct.images?.[0] || "https://via.placeholder.com/400x240"}
                  blurhash={featuredProduct.imageBlurhashes?.[0]}
                  style={homeStyles.featuredImage}
                />
                <View style={homeStyles.featuredOverlay}>
                  <View style={homeStyles.featuredBadge}>
                    <Text style={homeStyles.featuredBadgeText}>Featured</Text>
                  </View>

                  <View style={homeStyles.featuredContent}>
                    <Text style={homeStyles.featuredTitle} numberOfLines={2}>
                      {featuredProduct.title}
                    </Text>

                    <View style={homeStyles.featuredMeta}>
                      <View style={homeStyles.metaItem}>
                        <Text style={homeStyles.metaText}>
                          Ksh {featuredProduct.price}
                        </Text>
                      </View>
                      <View style={homeStyles.metaItem}>
                        <Text style={homeStyles.metaText}>
                          {featuredProduct.quantityAvailable} remaining
                        </Text>
                      </View>
                      {featuredProduct.isOrganic && (
                        <View style={homeStyles.metaItem}>
                          <Ionicons name="leaf-outline" size={16} color={COLORS.white} />
                          <Text style={homeStyles.metaText}>Organic</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Market Prices CTA */}
        <TouchableOpacity
          onPress={() => router.push('/market-prices')}
          style={[
            pstyles.addBtn,
            {
              marginHorizontal: 16,
              marginBottom: 12,
              width: '48%',
              alignSelf: 'center',
              backgroundColor: COLORS.card,
              borderWidth: 1,
              borderColor: COLORS.online,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
            }
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="storefront-outline" size={18} color={COLORS.online} style={{ marginRight: 8 }} />
          <Text style={[pstyles.addBtnText, { color: COLORS.online }]}>View Market Prices</Text>
        </TouchableOpacity>

        {/* Farmers Map CTA (hidden for now) */}
        {false && (
          <TouchableOpacity
            onPress={() => router.push('/farmers-map')}
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              backgroundColor: '#ecfeff',
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: '#a5f3fc',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="map" size={18} color="#0891b2" />
            <Ionicons name="location-outline" size={18} color="#0e7490" />
          </TouchableOpacity>
        )}

        {/* Categories */}
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Products Section */}
        <View style={homeStyles.productsSection}>
          <View style={homeStyles.sectionHeader}>
            <Text style={homeStyles.sectionTitle}>
              {selectedCategory ? selectedCategory : "Products"}
            </Text>
          </View>

          {filteredProducts.length > 0 ? (
            <FlatList
              data={filteredProducts}
              renderItem={({ item }) => <ProductCard product={item} />}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              columnWrapperStyle={homeStyles.row}
              contentContainerStyle={homeStyles.productsGrid}
              scrollEnabled={false}
            />
          ) : (
            <View style={homeStyles.emptyState}>
              <EmptyState context="products" />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
